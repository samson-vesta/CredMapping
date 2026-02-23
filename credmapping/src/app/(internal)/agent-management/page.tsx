"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { createClient } from "~/utils/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck,
  Shield,
  Crown,
  User,
  Loader2,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "~/components/ui/app-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// ─── Role badge helper ─────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "superadmin":
      return (
        <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/25 dark:text-amber-400">
          <Crown className="h-3 w-3" />
          Super Admin
        </Badge>
      );
    case "admin":
      return (
        <Badge className="gap-1 bg-blue-500/15 text-blue-600 border-blue-500/25 dark:text-blue-400">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <User className="h-3 w-3" />
          User
        </Badge>
      );
  }
}

// ─── Edit User Dialog ────────────────────────────────────────────
function EditUserDialog({
  agent,
  onSuccess,
  disabled = false,
}: {
  agent: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    team: string | null;
    teamNumber: number | null;
  };
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<"IN" | "US">(
    agent.team === "US" ? "US" : "IN",
  );
  const [teamNumber, setTeamNumber] = useState(
    agent.teamNumber ? String(agent.teamNumber) : "",
  );
  const [newRole, setNewRole] = useState<"user" | "admin" | "superadmin">(
    agent.role as "user" | "admin" | "superadmin",
  );

  const updateMutation = api.superadmin.updateAgent.useMutation({
    onSuccess: () => {
      toast.success(`Details updated for ${agent.firstName} ${agent.lastName}.`);
      setOpen(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const hasChanges =
    newRole !== agent.role ||
    team !== (agent.team === "US" ? "US" : "IN") ||
    (teamNumber.trim() === "" ? null : Number(teamNumber)) !== (agent.teamNumber ?? null);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setTeam(agent.team === "US" ? "US" : "IN");
          setTeamNumber(agent.teamNumber ? String(agent.teamNumber) : "");
          setNewRole(agent.role as "user" | "admin" | "superadmin");
        }
      }}
    >
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="ghost" size="sm" className="gap-1.5" disabled>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Edit User
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>You cannot change your own role</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Edit User
          </Button>
        </DialogTrigger>
      )}

      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>Edit User</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          {disabled && (
            <p className="text-xs text-muted-foreground">
              You cannot change your own permission level.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Team</label>
            <Select
              value={team}
              onValueChange={(value) => setTeam(value as "IN" | "US")}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">IN</SelectItem>
                <SelectItem value="US">US</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Team # (optional)</label>
            <Input
              type="number"
              value={teamNumber}
              onChange={(event) => setTeamNumber(event.target.value)}
              placeholder="e.g. 1"
              min={1}
              disabled={disabled}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Permission Level</label>
            <Select
              value={newRole}
              onValueChange={(value) => setNewRole(value as typeof newRole)}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
        </div>

        <ModalFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() =>
              updateMutation.mutate({
                agentId: agent.id,
                team,
                teamNumber: teamNumber.trim() === "" ? null : parseInt(teamNumber, 10),
                role: newRole,
              })
            }
            disabled={updateMutation.isPending || !hasChanges}
            type="button"
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const utils = api.useUtils();

  useEffect(() => {
    const loadCurrentUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);
    };

    void loadCurrentUser();
  }, []);

  const { data: agents, isLoading } = api.superadmin.listAgents.useQuery();

  const refetch = () => {
    void utils.superadmin.listAgents.invalidate();
  };

  const agentList = agents ?? [];

  return (
    <div className="space-y-6">
      {/* Agents table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !agentList.length ? (
        <div className="rounded-md border border-dashed bg-muted/20 h-64 flex flex-col items-center justify-center text-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No agents yet</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-xs">
            Add agents through your backend process, then manage their access here.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentList.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">
                    {agent.firstName} {agent.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {agent.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {agent.team}{agent.teamNumber != null ? ` #${agent.teamNumber}` : ""}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={agent.role} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditUserDialog
                        agent={agent}
                        onSuccess={refetch}
                        disabled={agent.userId === currentUserId}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary footer */}
      {agentList.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{agentList.length} agent{agentList.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>
            {agentList.filter((a) => a.role === "superadmin").length} super admin
            {agentList.filter((a) => a.role === "superadmin").length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            {agentList.filter((a) => a.role === "admin").length} admin
            {agentList.filter((a) => a.role === "admin").length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            {agentList.filter((a) => a.role === "user").length} user
            {agentList.filter((a) => a.role === "user").length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

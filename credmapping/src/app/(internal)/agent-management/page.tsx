"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { createClient } from "~/utils/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Search,
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

// ─── Assign Agent Dialog ────────────────────────────────────────
function AssignAgentDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [team, setTeam] = useState<"IN" | "US">("IN");
  const [teamNumber, setTeamNumber] = useState("");
  const [role, setRole] = useState<"user" | "admin" | "superadmin">("user");

  const { data: users, isLoading: usersLoading } =
    api.superadmin.listUnassignedUsers.useQuery(
      { search: search || undefined },
      { enabled: open },
    );

  const assignMutation = api.superadmin.assignAgent.useMutation({
    onSuccess: () => {
      toast.success("Agent assigned successfully.");
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetForm = () => {
    setSelectedUserId(null);
    setTeam("IN");
    setTeamNumber("");
    setRole("user");
    setSearch("");
  };

  const normalizedUsers = users ?? [];

  const selectedUser = normalizedUsers.find((u) => u.id === selectedUserId);

  const handleAssign = () => {
    if (!selectedUserId || !selectedUser) return;
    assignMutation.mutate({
      userId: selectedUserId,
      email: selectedUser.email,
      team,
      teamNumber: teamNumber ? parseInt(teamNumber, 10) : undefined,
      role,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Assign Agent
        </Button>
      </DialogTrigger>

      <ModalContent>
        <ModalHeader>
          <ModalTitle>Assign Agent from User Pool</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          {/* Search users */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Users</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* User list */}
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {usersLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : !normalizedUsers.length ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  No unassigned users found.
                </p>
              ) : (
                normalizedUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
                      selectedUserId === user.id
                        ? "bg-primary/10 font-medium"
                        : ""
                    }`}
                  >
                    {user.email}
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedUser && (
            <>
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedUser.email}</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Team</label>
                  <Select
                    value={team}
                    onValueChange={(v) => setTeam(v as "IN" | "US")}
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
                    onChange={(e) => setTeamNumber(e.target.value)}
                    placeholder="e.g. 1"
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Permission Level</label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as typeof role)}
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
            </>
          )}
        </div>

        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          {(() => {
            const disabledReason = assignMutation.isPending
              ? "Assignment in progress…"
              : !selectedUserId
              ? "Select a user first"
              : null;
            const btn = (
              <Button
                onClick={handleAssign}
                disabled={!!disabledReason}
              >
                {assignMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Assign Agent
              </Button>
            );
            return disabledReason ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{btn}</span>
                  </TooltipTrigger>
                  <TooltipContent>{disabledReason}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : btn;
          })()}
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Change Role Dialog ─────────────────────────────────────────
function ChangeRoleDialog({
  agent,
  onSuccess,
  disabled = false,
}: {
  agent: { id: string; firstName: string; lastName: string; role: string };
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [newRole, setNewRole] = useState(agent.role);

  const updateMutation = api.superadmin.updateAgentRole.useMutation({
    onSuccess: () => {
      toast.success(`Role updated for ${agent.firstName} ${agent.lastName}.`);
      setOpen(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="ghost" size="sm" className="gap-1.5" disabled>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Change Role
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
            Change Role
          </Button>
        </DialogTrigger>
      )}

      <ModalContent className="sm:max-w-sm">
        <ModalHeader>
          <ModalTitle>Change Role</ModalTitle>
        </ModalHeader>

        <p className="text-sm text-muted-foreground">
          Update permissions for{" "}
          <span className="font-medium">
            {agent.firstName} {agent.lastName}
          </span>
        </p>

        {disabled && (
          <p className="text-xs text-muted-foreground">
            You cannot change your own permission level.
          </p>
        )}

        <div className="py-4">
          <Select
            value={newRole}
            onValueChange={setNewRole}
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

        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          {(() => {
            const saveDisabledReason = updateMutation.isPending
              ? "Saving…"
              : newRole === agent.role
              ? "Role is already set to this value"
              : null;
            const saveBtn = (
              <Button
                onClick={() =>
                  updateMutation.mutate({
                    agentId: agent.id,
                    role: newRole as "user" | "admin" | "superadmin",
                  })
                }
                disabled={!!saveDisabledReason}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            );
            return saveDisabledReason ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{saveBtn}</span>
                  </TooltipTrigger>
                  <TooltipContent>{saveDisabledReason}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : saveBtn;
          })()}
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Remove Agent Dialog ────────────────────────────────────────
function RemoveAgentDialog({
  agent,
  onSuccess,
  disabled = false,
}: {
  agent: { id: string; firstName: string; lastName: string };
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const removeMutation = api.superadmin.removeAgent.useMutation({
    onSuccess: () => {
      toast.success(`${agent.firstName} ${agent.lastName} removed.`);
      setOpen(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>You cannot remove your own account</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </DialogTrigger>
      )}

      <ModalContent className="sm:max-w-sm">
        <ModalHeader>
          <ModalTitle>Remove Agent</ModalTitle>
        </ModalHeader>

        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove{" "}
          <span className="font-medium">
            {agent.firstName} {agent.lastName}
          </span>{" "}
          from the agent pool? This action cannot be undone.
        </p>

        {disabled && (
          <p className="text-xs text-muted-foreground">
            You cannot remove your own account from agent management.
          </p>
        )}

        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => removeMutation.mutate({ agentId: agent.id })}
            disabled={disabled || removeMutation.isPending}
          >
            {removeMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Remove
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [search, setSearch] = useState("");
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
    void utils.superadmin.listUnassignedUsers.invalidate();
  };

  const filtered = agents?.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.email.toLowerCase().includes(q) ||
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q) ||
      (a.team?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Search / filter bar */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <AssignAgentDialog onSuccess={refetch} />
      </div>

      {/* Agents table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered?.length ? (
        <div className="rounded-md border border-dashed bg-muted/20 h-64 flex flex-col items-center justify-center text-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <UserPlus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {search ? "No matching agents" : "No agents yet"}
          </h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-xs">
            {search
              ? "Try a different search term."
              : "Start by assigning users from the user pool as agents."}
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
              {filtered.map((agent) => (
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
                      <ChangeRoleDialog
                        agent={agent}
                        onSuccess={refetch}
                        disabled={agent.userId === currentUserId}
                      />
                      <RemoveAgentDialog
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
      {filtered && filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{filtered.length} agent{filtered.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>
            {filtered.filter((a) => a.role === "superadmin").length} super admin
            {filtered.filter((a) => a.role === "superadmin").length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            {filtered.filter((a) => a.role === "admin").length} admin
            {filtered.filter((a) => a.role === "admin").length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            {filtered.filter((a) => a.role === "user").length} user
            {filtered.filter((a) => a.role === "user").length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

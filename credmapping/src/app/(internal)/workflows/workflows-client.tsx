"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  Pause,
  Plus,
  Search,
  Trash2,
  User,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { Label } from "~/components/ui/label";

type WorkflowPhaseInput = {
  phaseName: string;
  startDate: string;
  dueDate: string;
  status: string;
  agentAssigned: string;
  workflowNotes: string;
};

/* ─── Helpers ──────────────────────────────────────────────── */

/** Fallback suggestions when no statuses exist in the DB yet */
const DEFAULT_STATUS_SUGGESTIONS = ["Pending", "In Progress", "Blocked", "Completed"];

const PFC_PHASES = [
  "Application Request",
  "Application Completion",
  "QA1",
  "QA2",
  "QA3",
  "Provider QA",
  "Facility Decision"
];

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  pfc: "PFC",
  state_licenses: "State Licenses",
  prelive_pipeline: "Pre-Live Pipeline",
  provider_vesta_privileges: "Vesta Privileges",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "Pending").toLowerCase();
  if (s === "completed" || s === "done" || s === "approved")
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/25 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> {status}
      </Badge>
    );
  if (s.includes("progress") || s.includes("processing") || s.includes("review"))
    return (
      <Badge className="gap-1 bg-blue-500/15 text-blue-600 border-blue-500/25 dark:text-blue-400">
        <Clock className="size-3" /> {status}
      </Badge>
    );
  if (s === "blocked" || s === "denied" || s === "rejected")
    return (
      <Badge className="gap-1 bg-red-500/15 text-red-600 border-red-500/25 dark:text-red-400">
        <Pause className="size-3" /> {status}
      </Badge>
    );
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="size-3" /> {status ?? "Pending"}
    </Badge>
  );
}

function WorkflowTypeBadge({ type }: { type: string }) {
  const label = WORKFLOW_TYPE_LABELS[type] ?? type;
  const colorMap: Record<string, string> = {
    pfc: "bg-violet-500/15 text-violet-600 border-violet-500/25 dark:text-violet-400",
    state_licenses: "bg-sky-500/15 text-sky-600 border-sky-500/25 dark:text-sky-400",
    prelive_pipeline: "bg-orange-500/15 text-orange-600 border-orange-500/25 dark:text-orange-400",
    provider_vesta_privileges: "bg-pink-500/15 text-pink-600 border-pink-500/25 dark:text-pink-400",
  };
  return <Badge className={cn("gap-1", colorMap[type] ?? "")}>{label}</Badge>;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── Incident Dialog ────────────────────────────────────── */

function IncidentDialog({
  workflowId,
  agents,
  incident,
  onSuccess,
}: {
  workflowId: string;
  agents: { id: string; name: string; email: string }[];
  incident?: {
    id: string;
    subcategory: string | null;
    critical: boolean | null;
    dateIdentified: string | null;
    incidentDescription: string | null;
    immediateResolutionAttempt: string | null;
    resolutionDate: string | null;
    finalResolution: string | null;
    preventativeActionTaken: string | null;
    followUpRequired: boolean | null;
    followUpDate: string | null;
    finalNotes: string | null;
    discussed: boolean | null;
  };
  onSuccess: () => void;
}) {
  const isEdit = !!incident;
  const [open, setOpen] = useState(false);

  const [subcategory, setSubcategory] = useState(incident?.subcategory ?? "");
  const [critical, setCritical] = useState(incident?.critical ?? false);
  const [dateIdentified, setDateIdentified] = useState(incident?.dateIdentified ?? "");
  const [description, setDescription] = useState(incident?.incidentDescription ?? "");
  const [immediateResolution, setImmediateResolution] = useState(incident?.immediateResolutionAttempt ?? "");
  const [escalatedTo, setEscalatedTo] = useState("");
  const [resolutionDate, setResolutionDate] = useState(incident?.resolutionDate ?? "");
  const [finalResolution, setFinalResolution] = useState(incident?.finalResolution ?? "");
  const [preventative, setPreventative] = useState(incident?.preventativeActionTaken ?? "");
  const [followUpRequired, setFollowUpRequired] = useState(incident?.followUpRequired ?? false);
  const [followUpDate, setFollowUpDate] = useState(incident?.followUpDate ?? "");
  const [finalNotes, setFinalNotes] = useState(incident?.finalNotes ?? "");
  const [discussed, setDiscussed] = useState(incident?.discussed ?? false);

  const createMutation = api.workflows.createIncident.useMutation({
    onSuccess: () => {
      toast.success("Incident logged.");
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(String(e.message)),
  });

  const updateMutation = api.workflows.updateIncident.useMutation({
    onSuccess: () => {
      toast.success("Incident updated.");
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(String(e.message)),
  });

  const isPending = createMutation.isPending ?? updateMutation.isPending;

  function reset() {
    setSubcategory(incident?.subcategory ?? "");
    setCritical(incident?.critical ?? false);
    setDateIdentified(incident?.dateIdentified ?? "");
    setDescription(incident?.incidentDescription ?? "");
    setImmediateResolution(incident?.immediateResolutionAttempt ?? "");
    setEscalatedTo("");
    setResolutionDate(incident?.resolutionDate ?? "");
    setFinalResolution(incident?.finalResolution ?? "");
    setPreventative(incident?.preventativeActionTaken ?? "");
    setFollowUpRequired(incident?.followUpRequired ?? false);
    setFollowUpDate(incident?.followUpDate ?? "");
    setFinalNotes(incident?.finalNotes ?? "");
    setDiscussed(incident?.discussed ?? false);
  }

  function handleSubmit() {
    if (!subcategory.trim()) {
      toast.error("Subcategory is required.");
      return;
    }
    if (!dateIdentified) {
      toast.error("Date identified is required.");
      return;
    }

    if (isEdit && incident) {
      updateMutation.mutate({
        id: incident.id,
        subcategory: subcategory.trim(),
        critical,
        resolutionDate: resolutionDate || undefined,
        finalResolution: finalResolution || undefined,
        preventativeActionTaken: preventative || undefined,
        followUpRequired,
        followUpDate: followUpDate || undefined,
        finalNotes: finalNotes || undefined,
        discussed,
      });
    } else {
      if (!escalatedTo) {
        toast.error("Please select who to escalate to.");
        return;
      }
      createMutation.mutate({
        workflowId,
        subcategory: subcategory.trim(),
        critical,
        dateIdentified,
        incidentDescription: description || undefined,
        immediateResolutionAttempt: immediateResolution || undefined,
        escalatedTo,
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            Edit
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="size-3.5" /> Log Incident
          </Button>
        )}
      </DialogTrigger>

      <ModalContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{isEdit ? "Edit Incident" : "Log New Incident"}</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Subcategory *</Label>
              <Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g. Missing Documentation" />
            </div>
            <div className="space-y-1.5">
              <Label>Date Identified *</Label>
              <Input type="date" value={dateIdentified} onChange={(e) => setDateIdentified(e.target.value)} />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="critical" checked={critical} onCheckedChange={(v) => setCritical(v === true)} />
                <Label htmlFor="critical" className="font-normal">Critical Incident</Label>
              </div>
            </div>

            {!isEdit && (
              <div className="col-span-2 space-y-1.5">
                <Label>Escalated To *</Label>
                <Select value={escalatedTo} onValueChange={setEscalatedTo}>
                  <SelectTrigger><SelectValue placeholder="Select agent…" /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Immediate Resolution Attempt</Label>
              <Textarea rows={2} value={immediateResolution} onChange={(e) => setImmediateResolution(e.target.value)} />
            </div>

            {isEdit && (
              <>
                <div className="space-y-1.5">
                  <Label>Resolution Date</Label>
                  <Input type="date" value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="followUp" checked={followUpRequired} onCheckedChange={(v) => setFollowUpRequired(v === true)} />
                    <Label htmlFor="followUp" className="font-normal">Follow-up Required</Label>
                  </div>
                </div>
                {followUpRequired && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Follow-up Date</Label>
                    <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                  </div>
                )}
                <div className="col-span-2 space-y-1.5">
                  <Label>Final Resolution</Label>
                  <Textarea rows={2} value={finalResolution} onChange={(e) => setFinalResolution(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Preventative Action Taken</Label>
                  <Textarea rows={2} value={preventative} onChange={(e) => setPreventative(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Final Notes</Label>
                  <Textarea rows={2} value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Checkbox id="discussed" checked={discussed} onCheckedChange={(v) => setDiscussed(v === true)} />
                  <Label htmlFor="discussed" className="font-normal">Discussed</Label>
                </div>
              </>
            )}
          </div>
        </div>

        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Log Incident"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

/* ─── Delete Incident Dialog ─────────────────────────────── */

function DeleteIncidentDialog({
  incident,
  onSuccess,
}: {
  incident: { id: string; subcategory: string | null };
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const deleteMutation = api.workflows.deleteIncident.useMutation({
    onSuccess: () => {
      toast.success("Incident deleted.");
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(String(e.message)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" />
        </Button>
      </DialogTrigger>
      <ModalContent className="sm:max-w-sm">
        <ModalHeader>
          <ModalTitle>Delete Incident</ModalTitle>
        </ModalHeader>
        <p className="text-sm text-muted-foreground py-2">
          Are you sure you want to delete the incident &quot;{incident.subcategory ?? "Untitled"}&quot;? This action cannot be undone.
        </p>
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => void deleteMutation.mutate({ id: String(incident.id) })}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

/* ─── Workflow Detail Sheet ──────────────────────────────── */

function WorkflowDetailSheet({
  workflowId,
  onClose,
  agentList,
  statusSuggestions,
}: {
  workflowId: string;
  onClose: () => void;
  agentList: { id: string; name: string; email: string }[];
  statusSuggestions: string[];
}) {
  const utils = api.useUtils();
  const { data: wf, isLoading } = api.workflows.getById.useQuery({ id: workflowId });
  const { data: incidents = [] } = api.workflows.listIncidents.useQuery({ workflowId });

  // Supporting agents
  const supportingIds = useMemo(
    () => ((wf?.supportingAgents as string[] | null) ?? []),
    [wf?.supportingAgents],
  );
  const { data: supportingNames = [] } = api.workflows.resolveAgentNames.useQuery(
    { ids: supportingIds },
    { enabled: supportingIds.length > 0 },
  );

  // Edit state (only the fields we allow editing)
  const [status, setStatus] = useState("");
  const [phaseName, setPhaseName] = useState("");
  const [notes, setNotes] = useState("");
  const [agentAssigned, setAgentAssigned] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [completedAt, setCompletedAt] = useState("");

  // Sync form when data loads
  useEffect(() => {
    if (wf) {
      setStatus(String(wf.status ?? "Pending"));
      setPhaseName(String(wf.phaseName));
      setNotes(String(wf.notes ?? ""));
      setAgentAssigned(wf.agentAssigned ? String(wf.agentAssigned) : null);
      setStartDate(String(wf.startDate ?? ""));
      setDueDate(String(wf.dueDate ?? ""));
      setCompletedAt(String(wf.completedAt ?? ""));
    }
  }, [wf]);

  const updateMutation = api.workflows.update.useMutation({
    onSuccess: () => {
      toast.success("Workflow updated.");
      void utils.workflows.list.invalidate();
      void utils.workflows.getById.invalidate({ id: workflowId });
    },
    onError: (e) => toast.error(String(e.message)),
  });

  const selfAssignMutation = api.workflows.selfAssign.useMutation({
    onSuccess: () => {
      toast.success("Workflow assigned to you.");
      void utils.workflows.list.invalidate();
      void utils.workflows.getById.invalidate({ id: workflowId });
    },
    onError: (e) => toast.error(String(e.message)),
  });

  function handleSave() {
    updateMutation.mutate({
      id: workflowId,
      phaseName: phaseName.trim() || undefined,
      status: status || undefined,
      notes: notes || undefined,
      agentAssigned: agentAssigned,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      completedAt: completedAt || undefined,
    });
  }

  function refreshIncidents() {
    void utils.workflows.listIncidents.invalidate({ workflowId });
  }

  const assignedName = wf?.assignedFirstName
    ? `${wf.assignedFirstName} ${wf.assignedLastName ?? ""}`.trim()
    : null;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{wf?.phaseName ?? "Loading…"}</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : wf ? (
          <Tabs defaultValue="details" className="mt-4">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="incidents">
                Incidents
                {incidents.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none">
                    {incidents.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ─── Details Tab ─── */}
            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <WorkflowTypeBadge type={wf.workflowType} />
                <StatusBadge status={wf.status} />
              </div>

              {/* ── Edit form ── */}
              <div className="space-y-3 rounded-md border p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Phase Name</Label>
                    <Input value={phaseName} onChange={(e) => setPhaseName(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Input
                      list="status-suggestions"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      placeholder="Type or pick a status…"
                    />
                    <datalist id="status-suggestions">
                      {statusSuggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Assigned Agent</Label>
                    <Select value={agentAssigned ?? "__none"} onValueChange={(v) => setAgentAssigned(v === "__none" ? null : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Unassigned</SelectItem>
                        {agentList.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Due Date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Completed Date</Label>
                    <Input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm">
                    {updateMutation.isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Supporting agents */}
              {supportingNames.length > 0 && (
                <div className="space-y-2 rounded-md border p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Supporting Agents</p>
                  <div className="flex flex-wrap gap-2">
                    {supportingNames.map((a) => (
                      <Badge key={a.id} variant="secondary" className="gap-1">
                        <Users className="size-3" /> {a.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignment info + self-assign */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Currently Assigned</p>
                  <p className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    {assignedName ?? "Unassigned"}
                  </p>
                  {!wf.agentAssigned && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 gap-1.5 h-7 text-xs"
                      disabled={selfAssignMutation.isPending}
                      onClick={() => void selfAssignMutation.mutate({ id: workflowId })}
                    >
                      {selfAssignMutation.isPending
                        ? <Loader2 className="size-3 animate-spin" />
                        : <UserPlus className="size-3" />}
                      Claim this workflow
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    {formatDate(String(wf.createdAt))}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ─── Incidents Tab ─── */}
            <TabsContent value="incidents" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Incident Log</p>
                <IncidentDialog
                  workflowId={workflowId}
                  agents={agentList}
                  onSuccess={refreshIncidents}
                />
              </div>

              {incidents.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center">
                  <AlertTriangle className="mx-auto size-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No incidents logged yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((inc) => (
                    <div key={String(inc.id)} className={cn("rounded-md border p-3 space-y-2", Boolean(inc.critical) && "border-red-500/50 bg-red-500/5")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{inc.subcategory}</span>
                            {inc.critical && (
                              <Badge className="bg-red-500/15 text-red-600 border-red-500/25 text-[10px] py-0 h-4">
                                CRITICAL
                              </Badge>
                            )}
                            {inc.followUpRequired && !inc.resolutionDate && (
                              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/25 text-[10px] py-0 h-4">
                                FOLLOW-UP
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Reported by {inc.reporterName ?? "Unknown"} · {formatDate(String(inc.dateIdentified))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <IncidentDialog
                            workflowId={workflowId}
                            agents={agentList}
                            incident={inc}
                            onSuccess={refreshIncidents}
                          />
                          <DeleteIncidentDialog incident={inc} onSuccess={refreshIncidents} />
                        </div>
                      </div>

                      {inc.incidentDescription && (
                        <p className="text-sm text-muted-foreground">{inc.incidentDescription}</p>
                      )}

                      {inc.finalResolution && (
                        <div className="rounded bg-muted/50 px-2 py-1.5">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase">Resolution</p>
                          <p className="text-sm">{inc.finalResolution}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-muted-foreground text-sm py-4">Workflow phase not found.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Add Workflow Dialog ────────────────────────────────── */

function AddWorkflowDialog() {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const [openProvider, setOpenProvider] = useState(false);
  const [openFacility, setOpenFacility] = useState(false);

  const [workflowType, setWorkflowType] = useState<"pfc" | "state_licenses" | "prelive_pipeline" | "provider_vesta_privileges">("pfc");
  const [providerId, setProviderId] = useState<string>("");
  const [facilityId, setFacilityId] = useState<string>("");

  const [phases, setPhases] = useState<WorkflowPhaseInput[]>(() => 
    PFC_PHASES.map((name) => ({
      phaseName: name,
      startDate: new Date().toISOString().split("T")[0]!,
      dueDate: "",
      status: "Pending",
      agentAssigned: "",
      workflowNotes: "",
    }))
  );

  // Update logic when workflow type changes
  useEffect(() => {
    if (workflowType === "pfc") {
      setPhases(PFC_PHASES.map((name) => ({
        phaseName: name,
        startDate: new Date().toISOString().split("T")[0]!,
        dueDate: "",
        status: "Pending",
        agentAssigned: "",
        workflowNotes: "",
      })));
    } else {
      // Default to 3 generic phases for other types
      setPhases([1, 2, 3].map((num) => ({
        phaseName: `Phase ${num}`,
        startDate: new Date().toISOString().split("T")[0]!,
        dueDate: "",
        status: "Pending",
        agentAssigned: "",
        workflowNotes: "",
      })));
    }
  }, [workflowType]);

  const [facilityType, setFacilityType] = useState<string>("");
  const [privileges, setPrivileges] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [applicationRequired, setApplicationRequired] = useState<boolean>(false);
  const [pfcNotes, setPfcNotes] = useState<string>("");

  const updatePhase = <K extends keyof WorkflowPhaseInput>(
    index: number,
    field: K,
    value: WorkflowPhaseInput[K]
  ) => {
    const nextPhases = [...phases];
    const targetPhase = nextPhases[index];

    if (targetPhase) {
      targetPhase[field] = value;
      setPhases(nextPhases);
    }
  };

  // Fetch lists for Dropdowns
  const { data: providers = [], isLoading: isLoadingProviders } = api.workflows.listProvidersForDropdown.useQuery(undefined, {
    enabled: open,
  });
  const { data: facilities = [], isLoading: isLoadingFacilities } = api.workflows.listFacilitiesForDropdown.useQuery(undefined, {
    enabled: open,
  });
  const { data: agentList = [] } = api.workflows.listAgents.useQuery(undefined, {
    enabled: open,
  });

  const createMutation = api.workflows.create.useMutation({
    onSuccess: () => {
      toast.success("New relationship and all workflow phases created!");
      setOpen(false);
      void utils.workflows.list.invalidate();
      resetForm();
    },
    onError: (e) => toast.error(String(e.message)),
  });

  function resetForm() {
    setProviderId("");
    setFacilityId("");
    setWorkflowType("pfc");
    setFacilityType("");
    setPrivileges("");
    setPriority("");
    setApplicationRequired(false);
    setPfcNotes("");
  }

  function handleCreate() {
    if (!providerId || !facilityId) {
      toast.error("Please select both a Provider and a Facility.");
      return;
    }

    createMutation.mutate({
      workflowType,
      providerId,
      facilityId,
      phases: phases.map(p => ({
        ...p,
        dueDate: p.dueDate || undefined,
        agentAssigned: p.agentAssigned || undefined,
        workflowNotes: p.workflowNotes || undefined
      })),
      facilityType: facilityType || undefined,
      privileges: privileges || undefined,
      priority: priority || undefined,
      applicationRequired,
      pfcNotes: pfcNotes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Add Workflow
        </Button>
      </DialogTrigger>

      <ModalContent className="sm:max-w-160 overflow-visible">
        <ModalHeader>
          <ModalTitle>Start Credentialing Process</ModalTitle>
        </ModalHeader>
        
        <div className="space-y-6 py-4 max-h-[75vh] overflow-y-auto px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {/* Workflow Type Selector */}
          <div className="space-y-1.5 px-1">
            <Label>Workflow Type</Label>
            <Select value={workflowType} onValueChange={(v: "pfc" | "state_licenses" | "prelive_pipeline" | "provider_vesta_privileges") => setWorkflowType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pfc">Provider Facility Credentials (PFC)</SelectItem>
                <SelectItem value="state_licenses">State Licenses</SelectItem>
                <SelectItem value="prelive_pipeline">Pre-Live Pipeline</SelectItem>
                <SelectItem value="provider_vesta_privileges">Vesta Privileges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
            <div className="space-y-1.5 flex flex-col">
              <Label>Provider *</Label>
              <Popover modal={true} open={openProvider} onOpenChange={setOpenProvider}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="justify-between font-normal w-full" disabled={isLoadingProviders}>
                    <span className="truncate">{providerId ? providers.find(p => p.id === providerId)?.name : "Search..."}</span>
                    <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search name..." />
                    <CommandList>
                      <CommandEmpty>No providers found.</CommandEmpty>
                      <CommandGroup>
                        {providers.map((p) => (
                          <CommandItem key={p.id} value={p.name} onSelect={() => { setProviderId(p.id); setOpenProvider(false); }}>
                            <CheckCircle2 className={cn("mr-2 h-4 w-4", providerId === p.id ? "opacity-100" : "opacity-0")} />
                            {p.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label>Facility *</Label>
              <Popover modal={true} open={openFacility} onOpenChange={setOpenFacility}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="justify-between font-normal w-full" disabled={isLoadingFacilities}>
                    <span className="truncate">{facilityId ? facilities.find(f => f.id === facilityId)?.name : "Search..."}</span>
                    <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search facility..." />
                    <CommandList>
                      <CommandEmpty>No facilities found.</CommandEmpty>
                      <CommandGroup>
                        {facilities.map((f) => (
                          <CommandItem key={f.id} value={f.name ?? ""} onSelect={() => { setFacilityId(f.id); setOpenFacility(false); }}>
                            <CheckCircle2 className={cn("mr-2 h-4 w-4", facilityId === f.id ? "opacity-100" : "opacity-0")} />
                            {f.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          {/* Relationship Details (PFC Specific) */}
          <div className="space-y-4 px-1">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Relationship Info (PFC Only)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Facility Type</Label>
                <Input value={facilityType} onChange={(e) => setFacilityType(e.target.value)} placeholder="e.g. Hospital" />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="High/Med/Low" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="appReq" checked={applicationRequired} onCheckedChange={(v) => setApplicationRequired(!!v)} />
              <Label htmlFor="appReq">Application Required</Label>
            </div>
          </div>

          <Separator />

          {/* Workflow Phases with Accordion */}
          <div className="space-y-4 px-1">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Configure Workflow Phases</h4>
            <Accordion type="single" collapsible className="w-full border rounded-md overflow-hidden bg-background">
              {phases.map((phase, index) => (
                <AccordionItem key={index} value={`phase-${index}`} className="px-3 border-b last:border-b-0">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="h-5 w-5 flex items-center justify-center p-0 rounded-full">{index + 1}</Badge>
                      <span className="font-medium text-sm">{phase.phaseName}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase">Phase Name</Label>
                        <Input size={1} value={phase.phaseName} onChange={(e) => updatePhase(index, 'phaseName', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase">Status</Label>
                        <Input size={1} value={phase.status} onChange={(e) => updatePhase(index, 'status', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase">Start Date</Label>
                        <Input type="date" value={phase.startDate} onChange={(e) => updatePhase(index, 'startDate', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase">Due Date</Label>
                        <Input type="date" value={phase.dueDate} onChange={(e) => updatePhase(index, 'dueDate', e.target.value)} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-[11px] uppercase">Assign Agent</Label>
                        <Select value={phase.agentAssigned} onValueChange={(v) => updatePhase(index, 'agentAssigned', v)}>
                          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            {agentList.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase">Phase Notes</Label>
                      <Textarea rows={2} value={phase.workflowNotes} onChange={(e) => updatePhase(index, 'workflowNotes', e.target.value)} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <ModalFooter className="border-t pt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleCreate} 
            disabled={createMutation.isPending || !providerId || !facilityId}
          >
            {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Workflow
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

/* ─── Main Workflows Page ────────────────────────────────── */

export default function WorkflowsClient() {
  const utils = api.useUtils();

  // Filter state
  const [workflowType, setWorkflowType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [assignedToAgent, setAssignedToAgent] = useState<string>("all");
  const [hasIncidents, setHasIncidents] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 40;

  // Selected workflow for detail sheet
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: workflows = [], isLoading, isFetching } = api.workflows.list.useQuery(
    {
      workflowType: workflowType as "all" | "pfc" | "state_licenses" | "prelive_pipeline" | "provider_vesta_privileges",
      status: status === "all" ? undefined : status,
      assignedToMe,
      assignedToAgent: assignedToAgent !== "all" ? assignedToAgent : undefined,
      hasIncidents,
      search: search.trim() || undefined,
      limit,
      offset,
    },
    { refetchOnWindowFocus: false },
  );

  const { data: agentList = [] } = api.workflows.listAgents.useQuery();
  const { data: dbStatuses = [] } = api.workflows.distinctStatuses.useQuery(
    { workflowType: workflowType as "all" | "pfc" | "state_licenses" | "prelive_pipeline" | "provider_vesta_privileges" },
  );

  // Merge DB statuses with defaults so the filter/suggestions always have useful options
  const statusSuggestions: string[] = useMemo(() => {
    const safeStatuses: string[] = Array.isArray(dbStatuses)
      ? (dbStatuses as unknown[]).map((s) => String(s))
      : [];
    const merged = new Set<string>([...safeStatuses, ...DEFAULT_STATUS_SUGGESTIONS]);
    return [...merged].sort();
  }, [dbStatuses]);

  const selfAssignMutation = api.workflows.selfAssign.useMutation({
    onSuccess: () => {
      toast.success("Workflow assigned to you.");
      void utils.workflows.list.invalidate();
    },
    onError: (e) => toast.error(String(e.message)),
  });

  const hasMore = workflows.length === limit;

  // ── Group flat phases by parent workflow (relatedId + workflowType) ──
  const groupedWorkflows = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        workflowType: string;
        contextLabel: string;
        relatedId: string;
        phases: typeof workflows;
        completedCount: number;
        totalCount: number;
        incidentCount: number;
        latestUpdate: string | Date | null;
        hasOverdue: boolean;
        hasBlocked: boolean;
      }
    >();

    for (const wf of workflows) {
      const key = `${wf.workflowType}:${wf.relatedId}`;
      const statusLower = (wf.status ?? "").toLowerCase();
      const isDone = [
        statusLower.includes("complet"),
        statusLower === "done",
        statusLower === "approved"
      ].some(Boolean);
      const isOverdue =
        !!wf.dueDate && new Date(String(wf.dueDate)) < new Date() && !isDone;
      const isBlocked = statusLower === "blocked";
      const phaseIncidents = typeof wf.incidentCount === "number" ? wf.incidentCount : 0;

      const existing = groups.get(key);
      if (existing) {
        existing.phases.push(wf);
        existing.totalCount++;
        existing.incidentCount += phaseIncidents;
        if (isDone) existing.completedCount++;
        if (isOverdue) existing.hasOverdue = true;
        if (isBlocked) existing.hasBlocked = true;
        if (
          wf.updatedAt &&
          (!existing.latestUpdate ||
            new Date(String(wf.updatedAt)) >
              new Date(String(existing.latestUpdate)))
        ) {
          existing.latestUpdate = wf.updatedAt;
        }
      } else {
        groups.set(key, {
          key,
          workflowType: wf.workflowType,
          contextLabel: wf.contextLabel ?? "Unknown",
          relatedId: wf.relatedId,
          phases: [wf],
          completedCount: isDone ? 1 : 0,
          totalCount: 1,
          incidentCount: phaseIncidents,
          latestUpdate: wf.updatedAt,
          hasOverdue: isOverdue,
          hasBlocked: isBlocked,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aTime = a.latestUpdate
        ? new Date(a.latestUpdate as string).getTime()
        : 0;
      const bTime = b.latestUpdate
        ? new Date(b.latestUpdate as string).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [workflows]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="size-6" /> Workflows
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage credentialing workflow phases, track progress, and log incidents.
          </p>
        </div>

        <AddWorkflowDialog />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 w-[200px]"
            placeholder="Search phases…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </div>

        <Select value={workflowType} onValueChange={(v) => { setWorkflowType(v); setStatus("all"); setOffset(0); }}>
          <SelectTrigger className="w-[160px]">
            <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pfc">PFC</SelectItem>
            <SelectItem value="state_licenses">State Licenses</SelectItem>
            <SelectItem value="prelive_pipeline">Pre-Live Pipeline</SelectItem>
            <SelectItem value="provider_vesta_privileges">Vesta Privileges</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0); }}>
          <SelectTrigger className="w-[140px]">
            <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusSuggestions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assigned-to filter: "All Agents", "My Workflows", or a specific agent */}
        <Select
          value={assignedToMe ? "__me__" : assignedToAgent}
          onValueChange={(v) => {
            if (v === "__me__") {
              setAssignedToMe(true);
              setAssignedToAgent("all");
            } else {
              setAssignedToMe(false);
              setAssignedToAgent(v);
            }
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <Users className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="__me__">My Workflows</SelectItem>
            {agentList.map((a) => (
              <SelectItem key={String(a.id)} value={String(a.id)}>
                {String(a.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={hasIncidents ? "default" : "outline"}
          size="sm"
          onClick={() => { setHasIncidents(!hasIncidents); setOffset(0); }}
          className="gap-1.5"
        >
          <AlertTriangle className="size-3.5" />
          {hasIncidents ? "Has Incidents" : "All"}
        </Button>
        
        {isFetching && !isLoading && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Grouped Workflow Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : groupedWorkflows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 h-64 flex flex-col items-center justify-center text-center p-8">
          <Workflow className="size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No workflows found</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            {search || workflowType !== "all" || status !== "all" || assignedToMe || assignedToAgent !== "all" || hasIncidents
              ? "Try adjusting your filters."
              : "Workflow phases are created when providers are assigned to facilities."}
          </p>
        </div>
      ) : (
        <>
          {/* Toolbar: count + expand/collapse */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {String(groupedWorkflows.length)} workflow{groupedWorkflows.length !== 1 ? "s" : ""} ·{" "}
              {String(workflows.length)} total phase{workflows.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (expandedGroups.size === groupedWorkflows.length) {
                  setExpandedGroups(new Set());
                } else {
                  setExpandedGroups(
                    new Set(groupedWorkflows.map((g) => String(g.key))),
                  );
                }
              }}
            >
              {expandedGroups.size === groupedWorkflows.length
                ? "Collapse All"
                : "Expand All"}
            </Button>
          </div>

          {/* Workflow cards */}
          <div className="space-y-3">
            {groupedWorkflows.map((group) => {
              const isExpanded = expandedGroups.has(String(group.key));
              const progress =
                group.totalCount > 0
                  ? Math.round(
                      (group.completedCount / group.totalCount) * 100,
                    )
                  : 0;

              return (
                <div
                  key={group.key}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  {/* ── Card header (click to expand) ── */}
                  <button
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroup(String(group.key))}
                  >
                    <ChevronRight
                      className={cn(
                        "size-4 mt-0.5 shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-90",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">
                          {group.contextLabel}
                        </h3>
                        <WorkflowTypeBadge type={group.workflowType} />
                        {group.hasOverdue && (
                          <Badge className="bg-red-500/15 text-red-600 border-red-500/25 text-[10px] py-0 h-4">
                            OVERDUE
                          </Badge>
                        )}
                        {group.hasBlocked && (
                          <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/25 text-[10px] py-0 h-4">
                            BLOCKED
                          </Badge>
                        )}
                        {group.incidentCount > 0 && (
                          <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/25 text-[10px] py-0 h-4 gap-0.5">
                            <AlertTriangle className="size-2.5" />
                            {group.incidentCount} incident{group.incidentCount !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span>
                          {group.completedCount}/{group.totalCount} phase
                          {group.totalCount !== 1 ? "s" : ""} done
                        </span>
                        <span>Updated {formatDate(group.latestUpdate ? String(group.latestUpdate) : new Date().toISOString())}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-full max-w-[200px] rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            progress === 100
                              ? "bg-emerald-500"
                              : "bg-blue-500",
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded phase list ── */}
                  {isExpanded && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Phase</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assigned</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead className="text-right">
                              Updated
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.phases.map((phase) => (
                            <TableRow
                              key={phase.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedId(String(phase.id))}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-1.5">
                                  {String(phase.phaseName)}
                                  <ChevronRight className="size-3 text-muted-foreground" />
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={phase.status} />
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {phase.assignedName ? (
                                  <>
                                    {phase.assignedName}
                                    {phase.supportingAgentIds.length > 0 && (
                                      <span className="ml-1 text-[10px] opacity-60">
                                        +{phase.supportingAgentIds.length}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 gap-1 px-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                    disabled={selfAssignMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selfAssignMutation.mutate({
                                        id: String(phase.id),
                                      });
                                    }}
                                  >
                                    <UserPlus className="size-3" /> Claim
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {formatDate(phase.startDate ? String(phase.startDate) : new Date().toISOString())}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {phase.dueDate ? (
                                  <span
                                    className={
                                      new Date(String(phase.dueDate)) < new Date() &&
                                      !(phase.status ?? "")
                                        .toLowerCase()
                                        .includes("complet")
                                        ? "text-red-500 font-medium"
                                        : ""
                                    }
                                  >
                                    {formatDate(phase.dueDate ? String(phase.dueDate) : new Date().toISOString())}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground text-xs">
                                {formatDate(phase.updatedAt ? String(phase.updatedAt) : new Date().toISOString())}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {(offset > 0 || hasMore) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {offset + 1}–{offset + workflows.length} phases
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      {workflows.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {workflows.filter(
              (w) => {
                const status = (w.status ?? "").toLowerCase();
                return Boolean(status.includes("complet")) || Boolean(status === "done");
              }
            ).length}{" "}
            completed
          </span>
          <span>·</span>
          <span>
            {
              workflows.filter(
                (w) => (w.status ?? "").toLowerCase() === "blocked",
              ).length
            }{" "}
            blocked
          </span>
          <span>·</span>
          <span>
            {
              workflows.filter(
                (w) => {
                  return Boolean(w.dueDate &&
                    new Date(String(w.dueDate)) < new Date() &&
                    !(w.status ?? "").toLowerCase().includes("complet"));
                }
              ).length
            }{" "}
            overdue
          </span>
        </div>
      )}

      {/* Detail Sheet */}
      {selectedId && (
        <WorkflowDetailSheet
          workflowId={selectedId}
          onClose={() => setSelectedId(null)}
          agentList={agentList}
          statusSuggestions={statusSuggestions}
        />
      )}
    </div>
  );
}
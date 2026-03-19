"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
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
import { Separator } from "~/components/ui/separator";
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
import { Dialog, DialogClose, DialogTrigger } from "~/components/ui/dialog";
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
import { VirtualScrollContainer } from "~/components/ui/virtual-scroll-container";

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
const DEFAULT_STATUS_SUGGESTIONS = [
  "Pending",
  "In Progress",
  "Blocked",
  "Completed",
];

const PFC_PHASES = [
  "Application Request",
  "Application Completion",
  "QA1",
  "QA2",
  "QA3",
  "Provider QA",
  "Facility Decision",
];

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  pfc: "PFC",
  state_licenses: "State Licenses",
  prelive_pipeline: "Pre-Live Pipeline",
  provider_vesta_privileges: "Vesta Privileges",
};

const WORKFLOW_TYPE_OUTLINE_STYLES: Record<string, string> = {
  pfc: "border-violet-500/40 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]",
  state_licenses:
    "border-sky-500/40 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.12)]",
  prelive_pipeline:
    "border-orange-500/40 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.12)]",
  provider_vesta_privileges:
    "border-pink-500/40 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.12)]",
};

const WORKFLOW_BATCH_SIZE = 8;
const WORKFLOW_FETCH_LIMIT = 1000;

type DueTone = "critical" | "warning" | "safe";

const WORKFLOW_DUE_TONE_BAR_STYLES = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  safe: "bg-emerald-500",
} satisfies Record<DueTone, string>;

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "Pending").toLowerCase();
  if (s === "completed" || s === "done" || s === "approved")
    return (
      <Badge className="gap-1 border-emerald-500/25 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> {status}
      </Badge>
    );
  if (
    s.includes("progress") ||
    s.includes("processing") ||
    s.includes("review")
  )
    return (
      <Badge className="gap-1 border-blue-500/25 bg-blue-500/15 text-blue-600 dark:text-blue-400">
        <Clock className="size-3" /> {status}
      </Badge>
    );
  if (s === "blocked" || s === "denied" || s === "rejected")
    return (
      <Badge className="gap-1 border-red-500/25 bg-red-500/15 text-red-600 dark:text-red-400">
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
    state_licenses:
      "bg-sky-500/15 text-sky-600 border-sky-500/25 dark:text-sky-400",
    prelive_pipeline:
      "bg-orange-500/15 text-orange-600 border-orange-500/25 dark:text-orange-400",
    provider_vesta_privileges:
      "bg-pink-500/15 text-pink-600 border-pink-500/25 dark:text-pink-400",
  };
  return <Badge className={cn("gap-1", colorMap[type] ?? "")}>{label}</Badge>;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").toLowerCase();
  return (
    normalized.includes("complet") ||
    normalized === "done" ||
    normalized === "approved"
  );
}

function toStartOfDay(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDueTone(dueDate: string | Date | null | undefined): DueTone {
  if (!dueDate) return "safe";

  const due = toStartOfDay(dueDate);
  if (Number.isNaN(due.getTime())) return "safe";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayDiff = Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff < 7) return "critical";
  if (dayDiff === 7) return "warning";
  return "safe";
}

function getWorkflowDueTone(
  phases: Array<{ dueDate: string | Date | null; status: string | null }>,
): DueTone {
  const nextDue = phases
    .filter((phase) => phase.dueDate && !isCompletedStatus(phase.status))
    .map((phase) => toStartOfDay(phase.dueDate!))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return nextDue ? getDueTone(nextDue) : "safe";
}

function WorkflowAutoAdvance({
  enabled,
  onAdvance,
  rootSelector,
  resetKey,
}: {
  enabled: boolean;
  onAdvance: () => void;
  rootSelector: string;
  resetKey: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasTriggeredRef = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
    setLoading(false);
  }, [resetKey]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const rootElement = document.querySelector(rootSelector);
    const sentinel = sentinelRef.current;

    if (!(rootElement instanceof HTMLElement) || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasTriggeredRef.current) {
          return;
        }

        hasTriggeredRef.current = true;
        setLoading(true);
        onAdvance();
      },
      {
        root: rootElement,
        rootMargin: "0px 0px 120px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [enabled, onAdvance, rootSelector]);

  if (!enabled) {
    return null;
  }

  return (
    <div ref={sentinelRef} className="flex min-h-12 items-center justify-center">
      {loading && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading more workflows...
        </div>
      )}
    </div>
  );
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
  const [dateIdentified, setDateIdentified] = useState(
    incident?.dateIdentified ?? "",
  );
  const [description, setDescription] = useState(
    incident?.incidentDescription ?? "",
  );
  const [immediateResolution, setImmediateResolution] = useState(
    incident?.immediateResolutionAttempt ?? "",
  );
  const [escalatedTo, setEscalatedTo] = useState("");
  const [resolutionDate, setResolutionDate] = useState(
    incident?.resolutionDate ?? "",
  );
  const [finalResolution, setFinalResolution] = useState(
    incident?.finalResolution ?? "",
  );
  const [preventative, setPreventative] = useState(
    incident?.preventativeActionTaken ?? "",
  );
  const [followUpRequired, setFollowUpRequired] = useState(
    incident?.followUpRequired ?? false,
  );
  const [followUpDate, setFollowUpDate] = useState(
    incident?.followUpDate ?? "",
  );
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

      <ModalContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <ModalHeader>
          <ModalTitle>
            {isEdit ? "Edit Incident" : "Log New Incident"}
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Subcategory *</Label>
              <Input
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g. Missing Documentation"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date Identified *</Label>
              <Input
                type="date"
                value={dateIdentified}
                onChange={(e) => setDateIdentified(e.target.value)}
              />
            </div>
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>Escalated To *</Label>
                <Select value={escalatedTo} onValueChange={setEscalatedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent…" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-2 flex items-center gap-2 pt-1">
              <Checkbox
                id="critical"
                checked={critical}
                onCheckedChange={(v) => setCritical(v === true)}
              />
              <Label htmlFor="critical" className="font-normal">
                Critical Incident
              </Label>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Immediate Resolution Attempt</Label>
              <Textarea
                rows={2}
                value={immediateResolution}
                onChange={(e) => setImmediateResolution(e.target.value)}
              />
            </div>

            {isEdit && (
              <>
                <div className="space-y-1.5">
                  <Label>Resolution Date</Label>
                  <Input
                    type="date"
                    value={resolutionDate}
                    onChange={(e) => setResolutionDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="followUp"
                      checked={followUpRequired}
                      onCheckedChange={(v) => setFollowUpRequired(v === true)}
                    />
                    <Label htmlFor="followUp" className="font-normal">
                      Follow-up Required
                    </Label>
                  </div>
                </div>
                {followUpRequired && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Follow-up Date</Label>
                    <Input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </div>
                )}
                <div className="col-span-2 space-y-1.5">
                  <Label>Final Resolution</Label>
                  <Textarea
                    rows={2}
                    value={finalResolution}
                    onChange={(e) => setFinalResolution(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Preventative Action Taken</Label>
                  <Textarea
                    rows={2}
                    value={preventative}
                    onChange={(e) => setPreventative(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Final Notes</Label>
                  <Textarea
                    rows={2}
                    value={finalNotes}
                    onChange={(e) => setFinalNotes(e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Checkbox
                    id="discussed"
                    checked={discussed}
                    onCheckedChange={(v) => setDiscussed(v === true)}
                  />
                  <Label htmlFor="discussed" className="font-normal">
                    Discussed
                  </Label>
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
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive h-7 w-7 p-0"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </DialogTrigger>
      <ModalContent className="sm:max-w-sm">
        <ModalHeader>
          <ModalTitle>Delete Incident</ModalTitle>
        </ModalHeader>
        <p className="text-muted-foreground py-2 text-sm">
          Are you sure you want to delete the incident &quot;
          {incident.subcategory ?? "Untitled"}&quot;? This action cannot be
          undone.
        </p>
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() =>
              void deleteMutation.mutate({ id: String(incident.id) })
            }
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

/* ─── Bulk Incident Dialog (multi-phase, independent forms) ── */

type BulkPhaseForm = {
  phaseId: string;
  phaseName: string;
  subcategory: string;
  critical: boolean;
  dateIdentified: string;
  description: string;
  immediateResolution: string;
  escalatedTo: string;
};

function emptyPhaseForm(phase: { id: string; phaseName: string }): BulkPhaseForm {
  return {
    phaseId: phase.id,
    phaseName: phase.phaseName,
    subcategory: "",
    critical: false,
    dateIdentified: "",
    description: "",
    immediateResolution: "",
    escalatedTo: "",
  };
}

function BulkIncidentDialog({
  phases,
  agents,
  onSuccess,
}: {
  phases: { id: string; phaseName: string }[];
  agents: { id: string; name: string; email: string }[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Step 0 = phase selection, step 1 = per-phase forms
  const [step, setStep] = useState<0 | 1>(0);
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<Set<string>>(new Set());
  const [phaseForms, setPhaseForms] = useState<BulkPhaseForm[]>([]);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);

  const createBulkMutation = api.workflows.createBulkIncidents.useMutation({
    onSuccess: () => {
      toast.success(`Incident logged for ${phaseForms.length} phase${phaseForms.length !== 1 ? "s" : ""}.`);
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(String(e.message)),
  });

  function reset() {
    setStep(0);
    setSelectedPhaseIds(new Set());
    setPhaseForms([]);
    setActivePhaseIdx(0);
  }

  function togglePhase(id: string) {
    setSelectedPhaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedPhaseIds.size === phases.length) {
      setSelectedPhaseIds(new Set());
    } else {
      setSelectedPhaseIds(new Set(phases.map((p) => p.id)));
    }
  }

  function proceedToForms() {
    if (selectedPhaseIds.size === 0) {
      toast.error("Select at least one phase.");
      return;
    }
    const selected = phases.filter((p) => selectedPhaseIds.has(p.id));
    setPhaseForms(selected.map(emptyPhaseForm));
    setActivePhaseIdx(0);
    setStep(1);
  }

  function updateForm(idx: number, patch: Partial<BulkPhaseForm>) {
    setPhaseForms((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    );
  }

  function validateForm(form: BulkPhaseForm): string | null {
    if (!form.subcategory.trim()) return `"${form.phaseName}" – Subcategory is required.`;
    if (!form.dateIdentified) return `"${form.phaseName}" – Date identified is required.`;
    if (!form.escalatedTo) return `"${form.phaseName}" – Escalated To is required.`;
    return null;
  }

  function handleSubmit() {
    for (const form of phaseForms) {
      const err = validateForm(form);
      if (err) {
        toast.error(err);
        const errIdx = phaseForms.indexOf(form);
        if (errIdx !== -1) setActivePhaseIdx(errIdx);
        return;
      }
    }

    createBulkMutation.mutate({
      incidents: phaseForms.map((f) => ({
        workflowId: f.phaseId,
        subcategory: f.subcategory.trim(),
        critical: f.critical,
        dateIdentified: f.dateIdentified,
        incidentDescription: f.description || undefined,
        immediateResolutionAttempt: f.immediateResolution || undefined,
        escalatedTo: f.escalatedTo,
      })),
    });
  }

  const activeForm = phaseForms[activePhaseIdx];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <AlertTriangle className="size-3.5" /> Bulk Log Incident
        </Button>
      </DialogTrigger>

      <ModalContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <ModalHeader>
          <ModalTitle>
            {step === 0 ? "Select Phases" : "Log Incidents"}
          </ModalTitle>
        </ModalHeader>

        {step === 0 ? (
          /* ── Step 0: Phase selection ── */
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Select Phases *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={toggleAll}
                >
                  {selectedPhaseIds.size === phases.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {phases.map((phase) => (
                  <label
                    key={phase.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      selectedPhaseIds.has(phase.id)
                        ? "bg-primary/10 font-medium"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      checked={selectedPhaseIds.has(phase.id)}
                      onCheckedChange={() => togglePhase(phase.id)}
                    />
                    {phase.phaseName}
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {selectedPhaseIds.size} of {phases.length} phase{phases.length !== 1 ? "s" : ""} selected
              </p>
            </div>

            <ModalFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={proceedToForms}>
                Continue
              </Button>
            </ModalFooter>
          </div>
        ) : (
          /* ── Step 1: Per-phase independent forms ── */
          <div className="space-y-4 py-2">
            {/* Phase tabs */}
            <div className="flex gap-1 overflow-x-auto rounded-md border p-1">
              {phaseForms.map((f, idx) => {
                const hasError = !!validateForm(f);
                const isFilled = !hasError;
                return (
                  <button
                    key={f.phaseId}
                    type="button"
                    onClick={() => setActivePhaseIdx(idx)}
                    className={cn(
                      "relative shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      idx === activePhaseIdx
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground",
                    )}
                  >
                    {f.phaseName}
                    {isFilled && idx !== activePhaseIdx && (
                      <CheckCircle2 className="ml-1 inline size-3 text-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active phase form */}
            {activeForm && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-semibold">{activeForm.phaseName}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Subcategory *</Label>
                    <Input
                      value={activeForm.subcategory}
                      onChange={(e) => updateForm(activePhaseIdx, { subcategory: e.target.value })}
                      placeholder="e.g. Missing Documentation"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date Identified *</Label>
                    <Input
                      type="date"
                      value={activeForm.dateIdentified}
                      onChange={(e) => updateForm(activePhaseIdx, { dateIdentified: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Escalated To *</Label>
                    <Select
                      value={activeForm.escalatedTo}
                      onValueChange={(v) => updateForm(activePhaseIdx, { escalatedTo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent…" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <Checkbox
                      id={`bulk-critical-${activeForm.phaseId}`}
                      checked={activeForm.critical}
                      onCheckedChange={(v) => updateForm(activePhaseIdx, { critical: v === true })}
                    />
                    <Label htmlFor={`bulk-critical-${activeForm.phaseId}`} className="font-normal">
                      Critical Incident
                    </Label>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      rows={2}
                      value={activeForm.description}
                      onChange={(e) => updateForm(activePhaseIdx, { description: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Immediate Resolution Attempt</Label>
                    <Textarea
                      rows={2}
                      value={activeForm.immediateResolution}
                      onChange={(e) => updateForm(activePhaseIdx, { immediateResolution: e.target.value })}
                    />
                  </div>
                </div>

                {/* Prev / Next within phases */}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={activePhaseIdx === 0}
                    onClick={() => setActivePhaseIdx((i) => i - 1)}
                  >
                    ← Prev Phase
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    {activePhaseIdx + 1} / {phaseForms.length}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={activePhaseIdx === phaseForms.length - 1}
                    onClick={() => setActivePhaseIdx((i) => i + 1)}
                  >
                    Next Phase →
                  </Button>
                </div>
              </div>
            )}

            <ModalFooter>
              <Button variant="outline" onClick={() => setStep(0)}>
                ← Back
              </Button>
              <Button onClick={handleSubmit} disabled={createBulkMutation.isPending}>
                {createBulkMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Log {phaseForms.length} Incident{phaseForms.length !== 1 ? "s" : ""}
              </Button>
            </ModalFooter>
          </div>
        )}
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
  const { data: wf, isLoading } = api.workflows.getById.useQuery({
    id: workflowId,
  });
  const { data: incidents = [] } = api.workflows.listIncidents.useQuery({
    workflowId,
  });

  // Supporting agents
  const supportingIds = useMemo(
    () => (wf?.supportingAgents as string[] | null) ?? [],
    [wf?.supportingAgents],
  );
  const { data: supportingNames = [] } =
    api.workflows.resolveAgentNames.useQuery(
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b px-6 pt-6 pr-14 pb-4">
          <SheetTitle>{wf?.phaseName ?? "Loading…"}</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : wf ? (
          <Tabs defaultValue="details" className="px-6 pt-5 pb-6">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="incidents">
                Incidents
                {incidents.length > 0 && (
                  <span className="bg-muted ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium">
                    {incidents.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ─── Details Tab ─── */}
            <TabsContent value="details" className="mt-4 space-y-4">
              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <WorkflowTypeBadge type={wf.workflowType} />
                <StatusBadge status={wf.status} />
              </div>

              {/* ── Edit form ── */}
              <div className="space-y-3 rounded-md border p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Phase Name
                    </Label>
                    <Input
                      value={phaseName}
                      onChange={(e) => setPhaseName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Status
                    </Label>
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
                    <Label className="text-muted-foreground text-xs">
                      Assigned Agent
                    </Label>
                    <Select
                      value={agentAssigned ?? "__none"}
                      onValueChange={(v) =>
                        setAgentAssigned(v === "__none" ? null : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Unassigned</SelectItem>
                        {agentList.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Start Date
                    </Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Due Date
                    </Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Completed Date
                    </Label>
                    <Input
                      type="date"
                      value={completedAt}
                      onChange={(e) => setCompletedAt(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Notes
                    </Label>
                    <Textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    size="sm"
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Supporting agents */}
              {supportingNames.length > 0 && (
                <div className="space-y-2 rounded-md border p-4">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    Supporting Agents
                  </p>
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
                  <p className="text-muted-foreground text-xs">
                    Currently Assigned
                  </p>
                  <p className="flex items-center gap-1.5">
                    <User className="text-muted-foreground size-3.5" />
                    {assignedName ?? "Unassigned"}
                  </p>
                  {!wf.agentAssigned && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-7 gap-1.5 text-xs"
                      disabled={selfAssignMutation.isPending}
                      onClick={() =>
                        void selfAssignMutation.mutate({ id: workflowId })
                      }
                    >
                      {selfAssignMutation.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <UserPlus className="size-3" />
                      )}
                      Claim this workflow
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="flex items-center gap-1.5">
                    <CalendarDays className="text-muted-foreground size-3.5" />
                    {formatDate(String(wf.createdAt))}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ─── Incidents Tab ─── */}
            <TabsContent value="incidents" className="mt-4 space-y-4">
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
                  <AlertTriangle className="text-muted-foreground/50 mx-auto size-8" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    No incidents logged yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((inc) => (
                    <div
                      key={String(inc.id)}
                      className={cn(
                        "space-y-2 rounded-md border p-3",
                        Boolean(inc.critical) &&
                          "border-red-500/50 bg-red-500/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {inc.subcategory}
                            </span>
                            {inc.critical && (
                              <Badge className="h-4 border-red-500/25 bg-red-500/15 py-0 text-[10px] text-red-600">
                                CRITICAL
                              </Badge>
                            )}
                            {inc.followUpRequired && !inc.resolutionDate && (
                              <Badge className="h-4 border-amber-500/25 bg-amber-500/15 py-0 text-[10px] text-amber-600">
                                FOLLOW-UP
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Reported by {inc.reporterName ?? "Unknown"} ·{" "}
                            {formatDate(String(inc.dateIdentified))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <IncidentDialog
                            workflowId={workflowId}
                            agents={agentList}
                            incident={inc}
                            onSuccess={refreshIncidents}
                          />
                          <DeleteIncidentDialog
                            incident={inc}
                            onSuccess={refreshIncidents}
                          />
                        </div>
                      </div>

                      {inc.incidentDescription && (
                        <p className="text-muted-foreground text-sm">
                          {inc.incidentDescription}
                        </p>
                      )}

                      {inc.finalResolution && (
                        <div className="bg-muted/50 rounded px-2 py-1.5">
                          <p className="text-muted-foreground text-[10px] font-medium uppercase">
                            Resolution
                          </p>
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
          <p className="text-muted-foreground px-6 py-4 text-sm">
            Workflow phase not found.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Add Workflow Dialog ────────────────────────────────── */

function AddWorkflowDialog() {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  // Dialog open states
  const [openProvider, setOpenProvider] = useState(false);
  const [openFacility, setOpenFacility] = useState(false);

  // Identifiers
  const [workflowType, setWorkflowType] = useState<
    "pfc" | "state_licenses" | "prelive_pipeline" | "provider_vesta_privileges"
  >("pfc");
  const [providerId, setProviderId] = useState<string>("");
  const [facilityId, setFacilityId] = useState<string>("");

  // PFC States
  const [facilityType, setFacilityType] = useState<string>("");
  const [privileges, setPrivileges] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [applicationRequired, setApplicationRequired] =
    useState<boolean>(false);
  const [pfcNotes, setPfcNotes] = useState<string>("");

  // State Licenses States
  const [licenseState, setLicenseState] = useState<string>("");
  const [licenseStatus, setLicenseStatus] = useState<string>("");
  const [licensePath, setLicensePath] = useState<string>("");
  const [licensePriority, setLicensePriority] = useState<string>("");
  const [licenseNotes, setLicenseNotes] = useState<string>("");
  const [licenseInitialOrRenewal, setLicenseInitialOrRenewal] = useState<
    "initial" | "renewal" | undefined
  >();
  const [licenseEmailSubject, setLicenseEmailSubject] = useState<string>("");
  const [licenseNumber, setLicenseNumber] = useState<string>("");

  // Pre-Live Pipeline States
  const [prelivePriority, setPrelivePriority] = useState<string>("");
  const [preliveGoLiveDate, setPreliveGoLiveDate] = useState<string>("");
  const [preliveCredentialingDueDate, setPreliveCredentialingDueDate] =
    useState<string>("");
  const [preliveTempsPossible, setPreliveTempsPossible] =
    useState<boolean>(false);
  const [prelivePayorEnrollmentRequired, setPrelivePayorEnrollmentRequired] =
    useState<boolean>(false);
  const [preliveMedicalDirectorNeeded, setPreliveMedicalDirectorNeeded] =
    useState<boolean>(false);
  const [preliveRsoNeeded, setPreliveRsoNeeded] = useState<boolean>(false);
  const [preliveLipNeeded, setPreliveLipNeeded] = useState<boolean>(false);

  // Vesta Privileges States
  const [vestaPrivilegeTier, setVestaPrivilegeTier] = useState<
    "Inactive" | "Full" | "Temp" | "In Progress" | undefined
  >("In Progress");

  const [phases, setPhases] = useState<WorkflowPhaseInput[]>(() =>
    PFC_PHASES.map((name) => ({
      phaseName: name,
      startDate: new Date().toISOString().split("T")[0]!,
      dueDate: "",
      status: "Pending",
      agentAssigned: "",
      workflowNotes: "",
    })),
  );

  // Update logic when workflow type changes
  useEffect(() => {
    if (workflowType === "pfc") {
      setPhases(
        PFC_PHASES.map((name) => ({
          phaseName: name,
          startDate: new Date().toISOString().split("T")[0]!,
          dueDate: "",
          status: "Pending",
          agentAssigned: "",
          workflowNotes: "",
        })),
      );
    } else {
      // Default to 3 generic phases for other types
      setPhases(
        [1, 2, 3].map((num) => ({
          phaseName: `Phase ${num}`,
          startDate: new Date().toISOString().split("T")[0]!,
          dueDate: "",
          status: "Pending",
          agentAssigned: "",
          workflowNotes: "",
        })),
      );
    }
  }, [workflowType]);

  const updatePhase = <K extends keyof WorkflowPhaseInput>(
    index: number,
    field: K,
    value: WorkflowPhaseInput[K],
  ) => {
    const nextPhases = [...phases];
    const targetPhase = nextPhases[index];
    if (targetPhase) {
      targetPhase[field] = value;
      setPhases(nextPhases);
    }
  };

  const addPhase = () => {
    setPhases([
      ...phases,
      {
        phaseName: `Phase ${phases.length + 1}`,
        startDate: new Date().toISOString().split("T")[0]!,
        dueDate: "",
        status: "Pending",
        agentAssigned: "",
        workflowNotes: "",
      },
    ]);
  };

  const removePhase = (indexToRemove: number) => {
    setPhases(phases.filter((_, index) => index !== indexToRemove));
  };

  const { data: providers = [], isLoading: isLoadingProviders } =
    api.workflows.listProvidersForDropdown.useQuery(undefined, {
      enabled: open,
    });
  const { data: facilities = [], isLoading: isLoadingFacilities } =
    api.workflows.listFacilitiesForDropdown.useQuery(undefined, {
      enabled: open,
    });
  const { data: agentList = [] } = api.workflows.listAgents.useQuery(
    undefined,
    {
      enabled: open,
    },
  );

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

    // Reset PFC
    setFacilityType("");
    setPrivileges("");
    setPriority("");
    setApplicationRequired(false);
    setPfcNotes("");

    // Reset State Licenses
    setLicenseState("");
    setLicenseStatus("");
    setLicensePath("");
    setLicensePriority("");
    setLicenseNotes("");
    setLicenseInitialOrRenewal(undefined);
    setLicenseEmailSubject("");
    setLicenseNumber("");

    // Reset Pre-Live
    setPrelivePriority("");
    setPreliveGoLiveDate("");
    setPreliveCredentialingDueDate("");
    setPreliveTempsPossible(false);
    setPrelivePayorEnrollmentRequired(false);
    setPreliveMedicalDirectorNeeded(false);
    setPreliveRsoNeeded(false);
    setPreliveLipNeeded(false);

    // Reset Vesta Privs
    setVestaPrivilegeTier("In Progress");

    setPhases(
      PFC_PHASES.map((name) => ({
        phaseName: name,
        startDate: new Date().toISOString().split("T")[0]!,
        dueDate: "",
        status: "Pending",
        agentAssigned: "",
        workflowNotes: "",
      })),
    );
  }

  function handleCreate() {
    const needsProvider = [
      "pfc",
      "state_licenses",
      "provider_vesta_privileges",
    ].includes(workflowType);
    const needsFacility = ["pfc", "prelive_pipeline"].includes(workflowType);

    if (needsProvider && !providerId) {
      toast.error("Please select a Provider.");
      return;
    }
    if (needsFacility && !facilityId) {
      toast.error("Please select a Facility.");
      return;
    }

    // Build the payload dynamically
    createMutation.mutate({
      workflowType,
      providerId: needsProvider ? providerId : undefined,
      facilityId: needsFacility ? facilityId : undefined,
      phases: phases.map((p) => ({
        ...p,
        dueDate: p.dueDate || undefined,
        agentAssigned: p.agentAssigned || undefined,
        workflowNotes: p.workflowNotes || undefined,
      })),

      // PFC Data
      facilityType:
        workflowType === "pfc" ? facilityType || undefined : undefined,
      privileges: workflowType === "pfc" ? privileges || undefined : undefined,
      priority: workflowType === "pfc" ? priority || undefined : undefined,
      applicationRequired:
        workflowType === "pfc" ? applicationRequired : undefined,
      pfcNotes: workflowType === "pfc" ? pfcNotes || undefined : undefined,

      // State License Data
      licenseState:
        workflowType === "state_licenses"
          ? licenseState || undefined
          : undefined,
      licenseStatus:
        workflowType === "state_licenses"
          ? licenseStatus || undefined
          : undefined,
      licensePath:
        workflowType === "state_licenses"
          ? licensePath || undefined
          : undefined,
      licensePriority:
        workflowType === "state_licenses"
          ? licensePriority || undefined
          : undefined,
      licenseNotes:
        workflowType === "state_licenses"
          ? licenseNotes || undefined
          : undefined,
      licenseInitialOrRenewal:
        workflowType === "state_licenses" ? licenseInitialOrRenewal : undefined,
      licenseEmailSubjectOrTicketNum:
        workflowType === "state_licenses"
          ? licenseEmailSubject || undefined
          : undefined,
      licenseNumber:
        workflowType === "state_licenses"
          ? licenseNumber || undefined
          : undefined,

      // Pre-Live Pipeline Data
      prelivePriority:
        workflowType === "prelive_pipeline"
          ? prelivePriority || undefined
          : undefined,
      preliveGoLiveDate:
        workflowType === "prelive_pipeline"
          ? preliveGoLiveDate || undefined
          : undefined,
      preliveCredentialingDueDate:
        workflowType === "prelive_pipeline"
          ? preliveCredentialingDueDate || undefined
          : undefined,
      preliveTempsPossible:
        workflowType === "prelive_pipeline" ? preliveTempsPossible : undefined,
      prelivePayorEnrollmentRequired:
        workflowType === "prelive_pipeline"
          ? prelivePayorEnrollmentRequired
          : undefined,
      preliveMedicalDirectorNeeded:
        workflowType === "prelive_pipeline"
          ? preliveMedicalDirectorNeeded
          : undefined,
      preliveRsoNeeded:
        workflowType === "prelive_pipeline" ? preliveRsoNeeded : undefined,
      preliveLipNeeded:
        workflowType === "prelive_pipeline" ? preliveLipNeeded : undefined,

      // Vesta Privileges Data
      vestaPrivilegeTier:
        workflowType === "provider_vesta_privileges"
          ? vestaPrivilegeTier
          : undefined,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="relative -top-px h-9 gap-2">
          <Plus className="size-4" /> Add Workflow
        </Button>
      </DialogTrigger>

      <ModalContent className="overflow-visible sm:max-w-2xl">
        <ModalHeader>
          <ModalTitle>Start Credentialing Process</ModalTitle>
        </ModalHeader>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto px-1 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Workflow Type Selector */}
          <div className="space-y-1.5 px-1">
            <Label>Workflow Type</Label>
            <Select
              value={workflowType}
              onValueChange={(
                v:
                  | "pfc"
                  | "state_licenses"
                  | "prelive_pipeline"
                  | "provider_vesta_privileges",
              ) => setWorkflowType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pfc">
                  Provider Facility Credentials (PFC)
                </SelectItem>
                <SelectItem value="state_licenses">State Licenses</SelectItem>
                <SelectItem value="prelive_pipeline">
                  Pre-Live Pipeline
                </SelectItem>
                <SelectItem value="provider_vesta_privileges">
                  Vesta Privileges
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Identifiers */}
          <div className="grid grid-cols-1 gap-4 px-1 sm:grid-cols-2">
            {(workflowType === "pfc" ||
              workflowType === "provider_vesta_privileges") && (
              <div className="flex flex-col space-y-1.5">
                <Label>Provider *</Label>
                <Popover
                  modal={true}
                  open={openProvider}
                  onOpenChange={setOpenProvider}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      disabled={isLoadingProviders}
                    >
                      <span className="truncate">
                        {providerId
                          ? providers.find((p) => p.id === providerId)?.name
                          : "Search..."}
                      </span>
                      <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search name..." />
                      <CommandList>
                        <CommandEmpty>No providers found.</CommandEmpty>
                        <CommandGroup>
                          {providers.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setProviderId(p.id);
                                setOpenProvider(false);
                              }}
                            >
                              <CheckCircle2
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  providerId === p.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {p.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(workflowType === "pfc" ||
              workflowType === "prelive_pipeline") && (
              <div className="flex flex-col space-y-1.5">
                <Label>Facility *</Label>
                <Popover
                  modal={true}
                  open={openFacility}
                  onOpenChange={setOpenFacility}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      disabled={isLoadingFacilities}
                    >
                      <span className="truncate">
                        {facilityId
                          ? facilities.find((f) => f.id === facilityId)?.name
                          : "Search..."}
                      </span>
                      <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search facility..." />
                      <CommandList>
                        <CommandEmpty>No facilities found.</CommandEmpty>
                        <CommandGroup>
                          {facilities.map((f) => (
                            <CommandItem
                              key={f.id}
                              value={f.name ?? ""}
                              onSelect={() => {
                                setFacilityId(f.id);
                                setOpenFacility(false);
                              }}
                            >
                              <CheckCircle2
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  facilityId === f.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {f.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {workflowType === "state_licenses" && (
              <>
                <div className="flex flex-col space-y-1.5">
                  <Label>Provider *</Label>
                  <Popover
                    modal={true}
                    open={openProvider}
                    onOpenChange={setOpenProvider}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        disabled={isLoadingProviders}
                      >
                        <span className="truncate">
                          {providerId
                            ? providers.find((p) => p.id === providerId)?.name
                            : "Search..."}
                        </span>
                        <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search name..." />
                        <CommandList>
                          <CommandEmpty>No providers found.</CommandEmpty>
                          <CommandGroup>
                            {providers.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.name}
                                onSelect={() => {
                                  setProviderId(p.id);
                                  setOpenProvider(false);
                                }}
                              >
                                <CheckCircle2
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    providerId === p.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {p.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label>State *</Label>
                  <Input
                    value={licenseState}
                    onChange={(e) => setLicenseState(e.target.value)}
                    placeholder="e.g. Florida"
                  />
                </div>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                {workflowType === "pfc"
                  ? "Relationship Info"
                  : workflowType === "state_licenses"
                    ? "License Details"
                    : workflowType === "prelive_pipeline"
                      ? "Pipeline Milestones"
                      : "Vesta Details"}
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] font-normal opacity-70"
              >
                Optional
              </Badge>
            </div>

            {/* PFC FIELDS */}
            {workflowType === "pfc" && (
              <div className="space-y-4 px-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Facility Type</Label>
                    <Input
                      value={facilityType}
                      onChange={(e) => setFacilityType(e.target.value)}
                      placeholder="e.g. Hospital"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Input
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      placeholder="High/Med/Low"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Privileges</Label>
                    <Input
                      value={privileges}
                      onChange={(e) => setPrivileges(e.target.value)}
                      placeholder="e.g. Initial"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>PFC Notes</Label>
                  <Textarea
                    rows={2}
                    value={pfcNotes}
                    onChange={(e) => setPfcNotes(e.target.value)}
                    placeholder="Internal notes about this relationship..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="appReq"
                    checked={applicationRequired}
                    onCheckedChange={(v) => setApplicationRequired(!!v)}
                  />
                  <Label htmlFor="appReq">Application Required</Label>
                </div>
              </div>
            )}

            {/* STATE LICENSE FIELDS */}
            {workflowType === "state_licenses" && (
              <div className="space-y-4 px-1">
                <div className="space-y-1.5">
                  <Label>Current Status</Label>
                  <Input
                    value={licenseStatus}
                    onChange={(e) => setLicenseStatus(e.target.value)}
                    placeholder="e.g. Pending Compact LOQ"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Input
                      value={licensePriority}
                      onChange={(e) => setLicensePriority(e.target.value)}
                      placeholder="High/Med/Low"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={licenseInitialOrRenewal}
                      onValueChange={(v: "initial" | "renewal") =>
                        setLicenseInitialOrRenewal(v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="initial">Initial</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email / Ticket #</Label>
                    <Input
                      value={licenseEmailSubject}
                      onChange={(e) => setLicenseEmailSubject(e.target.value)}
                      placeholder="Ref number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>License #</Label>
                    <Input
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="If known"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Path / URL</Label>
                  <Input
                    value={licensePath}
                    onChange={(e) => setLicensePath(e.target.value)}
                    placeholder="e.g. via Medical Board"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>License Notes</Label>
                  <Textarea
                    rows={2}
                    value={licenseNotes}
                    onChange={(e) => setLicenseNotes(e.target.value)}
                    placeholder="Any specific state requirements..."
                  />
                </div>
              </div>
            )}

            {/* PRE-LIVE PIPELINE FIELDS */}
            {workflowType === "prelive_pipeline" && (
              <div className="space-y-4 px-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Target Go-Live</Label>
                    <Input
                      type="date"
                      value={preliveGoLiveDate}
                      onChange={(e) => setPreliveGoLiveDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Credentialing Due</Label>
                    <Input
                      type="date"
                      value={preliveCredentialingDueDate}
                      onChange={(e) =>
                        setPreliveCredentialingDueDate(e.target.value)
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Priority</Label>
                    <Input
                      value={prelivePriority}
                      onChange={(e) => setPrelivePriority(e.target.value)}
                      placeholder="High/Med/Low"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="temps"
                      checked={preliveTempsPossible}
                      onCheckedChange={(v) => setPreliveTempsPossible(!!v)}
                    />
                    <Label htmlFor="temps" className="text-sm">
                      Temps Possible
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="payor"
                      checked={prelivePayorEnrollmentRequired}
                      onCheckedChange={(v) =>
                        setPrelivePayorEnrollmentRequired(!!v)
                      }
                    />
                    <Label htmlFor="payor" className="text-sm">
                      Payor Enrollment
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="director"
                      checked={preliveMedicalDirectorNeeded}
                      onCheckedChange={(v) =>
                        setPreliveMedicalDirectorNeeded(!!v)
                      }
                    />
                    <Label htmlFor="director" className="text-sm">
                      Med Director Needed
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rso"
                      checked={preliveRsoNeeded}
                      onCheckedChange={(v) => setPreliveRsoNeeded(!!v)}
                    />
                    <Label htmlFor="rso" className="text-sm">
                      RSO Needed
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="lip"
                      checked={preliveLipNeeded}
                      onCheckedChange={(v) => setPreliveLipNeeded(!!v)}
                    />
                    <Label htmlFor="lip" className="text-sm">
                      LIP Needed
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* VESTA PRIVILEGES FIELDS */}
            {workflowType === "provider_vesta_privileges" && (
              <div className="space-y-4 px-1">
                <div className="space-y-1.5">
                  <Label>Initial Privilege Tier</Label>
                  <Select
                    value={vestaPrivilegeTier}
                    onValueChange={(
                      v: "Inactive" | "Full" | "Temp" | "In Progress",
                    ) => setVestaPrivilegeTier(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Tier..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Temp">Temp</SelectItem>
                      <SelectItem value="Full">Full</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Workflow Phases with Accordion */}
          <div className="space-y-4 px-1">
            <div className="flex items-center justify-between">
              <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Configure Workflow Phases
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={addPhase}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 size-3" /> Add Phase
              </Button>
            </div>
            <Accordion
              type="single"
              collapsible
              className="bg-background w-full overflow-hidden rounded-md border"
            >
              {phases && phases.length > 0 ? (
                phases.map((phase, index) => (
                  <AccordionItem
                    key={index}
                    value={`phase-${index}`}
                    className="w-full border-b px-3 last:border-b-0"
                  >
                    <div className="flex w-full items-center gap-2 [&>h3]:flex-1">
                      <AccordionTrigger className="w-full flex-1 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="secondary"
                            className="flex h-5 w-5 items-center justify-center rounded-full p-0"
                          >
                            {index + 1}
                          </Badge>
                          <span className="text-sm font-medium">
                            {phase.phaseName}
                          </span>
                        </div>
                      </AccordionTrigger>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
                        onClick={() => removePhase(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <AccordionContent className="space-y-4 pt-1 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase">
                            Phase Name
                          </Label>
                          <Input
                            size={1}
                            value={phase.phaseName}
                            onChange={(e) =>
                              updatePhase(index, "phaseName", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase">
                            Status
                          </Label>
                          <Input
                            size={1}
                            value={phase.status}
                            onChange={(e) =>
                              updatePhase(index, "status", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase">
                            Start Date
                          </Label>
                          <Input
                            type="date"
                            value={phase.startDate}
                            onChange={(e) =>
                              updatePhase(index, "startDate", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase">
                            Due Date
                          </Label>
                          <Input
                            type="date"
                            value={phase.dueDate}
                            onChange={(e) =>
                              updatePhase(index, "dueDate", e.target.value)
                            }
                          />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-[11px] uppercase">
                            Assign Agent
                          </Label>
                          <Select
                            value={phase.agentAssigned}
                            onValueChange={(v) =>
                              updatePhase(index, "agentAssigned", v)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              {agentList.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase">
                          Phase Notes
                        </Label>
                        <Textarea
                          rows={2}
                          value={phase.workflowNotes}
                          onChange={(e) =>
                            updatePhase(index, "workflowNotes", e.target.value)
                          }
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center">
                  <AlertTriangle className="text-muted-foreground/50 mx-auto size-8" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    No phases added yet.
                  </p>
                </div>
              )}
            </Accordion>
          </div>
        </div>

        <ModalFooter className="border-t pt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleCreate}
            disabled={
              createMutation.isPending ||
              (["pfc", "state_licenses", "provider_vesta_privileges"].includes(
                workflowType,
              ) &&
                !providerId) ||
              (["pfc", "prelive_pipeline"].includes(workflowType) &&
                !facilityId) ||
              (workflowType === "state_licenses" && !licenseState)
            }
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
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

  const [workflowType, setWorkflowType] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_assigned_desc");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(WORKFLOW_BATCH_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const {
    data: workflows = [],
    isLoading,
    isFetching,
  } = api.workflows.list.useQuery(
    {
      workflowType: workflowType as
        | "all"
        | "pfc"
        | "state_licenses"
        | "prelive_pipeline"
        | "provider_vesta_privileges",
      assignedToMe: agentFilter === "__me__",
      assignedToAgent:
        agentFilter !== "all" && agentFilter !== "__me__"
          ? agentFilter
          : undefined,
      limit: WORKFLOW_FETCH_LIMIT,
      offset: 0,
    },
    { refetchOnWindowFocus: false },
  );

  const { data: agentList = [] } = api.workflows.listAgents.useQuery();
  const { data: dbStatuses = [] } = api.workflows.distinctStatuses.useQuery({
    workflowType: workflowType as
      | "all"
      | "pfc"
      | "state_licenses"
      | "prelive_pipeline"
      | "provider_vesta_privileges",
  });

  const statusSuggestions: string[] = useMemo(() => {
    const safeStatuses: string[] = Array.isArray(dbStatuses)
      ? (dbStatuses as unknown[]).map((s) => String(s))
      : [];
    const merged = new Set<string>([
      ...safeStatuses,
      ...DEFAULT_STATUS_SUGGESTIONS,
    ]);
    return [...merged].sort();
  }, [dbStatuses]);

  const selfAssignMutation = api.workflows.selfAssign.useMutation({
    onSuccess: () => {
      toast.success("Workflow assigned to you.");
      void utils.workflows.list.invalidate();
    },
    onError: (e) => toast.error(String(e.message)),
  });

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
        latestStartDate: string | Date | null;
        latestAssignedDate: string | Date | null;
        hasOverdue: boolean;
        hasBlocked: boolean;
      }
    >();

    for (const wf of workflows) {
      const key = `${wf.workflowType}:${wf.relatedId}`;
      const statusLower = (wf.status ?? "").toLowerCase();
      const isDone = isCompletedStatus(wf.status);
      const isOverdue =
        !!wf.dueDate && new Date(String(wf.dueDate)) < new Date() && !isDone;
      const isBlocked = statusLower === "blocked";
      const phaseIncidents =
        typeof wf.incidentCount === "number" ? wf.incidentCount : 0;

      const existing = groups.get(key);
      if (existing) {
        existing.phases.push(wf);
        existing.totalCount++;
        existing.incidentCount += phaseIncidents;
        if (isDone) existing.completedCount++;
        if (isOverdue) existing.hasOverdue = true;
        if (isBlocked) existing.hasBlocked = true;
        if (
          wf.startDate &&
          (!existing.latestStartDate ||
            new Date(String(wf.startDate)) >
              new Date(String(existing.latestStartDate)))
        ) {
          existing.latestStartDate = wf.startDate;
        }
        if (
          wf.createdAt &&
          (!existing.latestAssignedDate ||
            new Date(String(wf.createdAt)) >
              new Date(String(existing.latestAssignedDate)))
        ) {
          existing.latestAssignedDate = wf.createdAt;
        }
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
          latestStartDate: wf.startDate,
          latestAssignedDate: wf.createdAt,
          hasOverdue: isOverdue,
          hasBlocked: isBlocked,
        });
      }
    }

    return Array.from(groups.values());
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();

    const matchingGroups = trimmedSearch
      ? groupedWorkflows.filter((group) => {
          const matchesContext = group.contextLabel
            .toLowerCase()
            .includes(trimmedSearch);
          const matchesType = (
            WORKFLOW_TYPE_LABELS[group.workflowType] ?? group.workflowType
          )
            .toLowerCase()
            .includes(trimmedSearch);
          const matchesPhase = group.phases.some((phase) => {
            const phaseName = String(phase.phaseName ?? "").toLowerCase();
            const assignedName = String(phase.assignedName ?? "").toLowerCase();
            return (
              phaseName.includes(trimmedSearch) ||
              assignedName.includes(trimmedSearch)
            );
          });

          return matchesContext || matchesType || matchesPhase;
        })
      : groupedWorkflows;

    const getTimestamp = (value: string | Date | null) =>
      value ? new Date(value).getTime() : 0;

    return [...matchingGroups].sort((a, b) => {
      const aStarted = getTimestamp(a.latestStartDate);
      const bStarted = getTimestamp(b.latestStartDate);
      const aAssigned = getTimestamp(a.latestAssignedDate);
      const bAssigned = getTimestamp(b.latestAssignedDate);

      if (sortBy === "date_started_asc") return aStarted - bStarted;
      if (sortBy === "date_started_desc") return bStarted - aStarted;
      if (sortBy === "date_assigned_asc") return aAssigned - bAssigned;
      return bAssigned - aAssigned;
    });
  }, [groupedWorkflows, search, sortBy]);

  const filteredPhases = useMemo(
    () => filteredWorkflows.flatMap((group) => group.phases),
    [filteredWorkflows],
  );

  useEffect(() => {
    setVisibleCount(WORKFLOW_BATCH_SIZE);
  }, [workflowType, agentFilter, search, sortBy]);

  const visibleGroups = useMemo(
    () => filteredWorkflows.slice(0, visibleCount),
    [filteredWorkflows, visibleCount],
  );

  const hasMoreGroups = visibleGroups.length < filteredWorkflows.length;

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
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_180px_180px_220px_auto]">
        <div className="relative min-w-0">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            className="h-10 w-full pl-9"
            placeholder="Search workflows, phases, or agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={workflowType} onValueChange={setWorkflowType}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pfc">PFC</SelectItem>
            <SelectItem value="state_licenses">State Licenses</SelectItem>
            <SelectItem value="prelive_pipeline">Pre-Live Pipeline</SelectItem>
            <SelectItem value="provider_vesta_privileges">
              Vesta Privileges
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="h-10 w-full">
            <Users className="text-muted-foreground mr-1.5 size-3.5" />
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

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-10 w-full">
            <ArrowUpDown className="text-muted-foreground mr-1.5 size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_assigned_desc">
              Date Assigned: Newest
            </SelectItem>
            <SelectItem value="date_assigned_asc">
              Date Assigned: Oldest
            </SelectItem>
            <SelectItem value="date_started_desc">
              Date Started: Newest
            </SelectItem>
            <SelectItem value="date_started_asc">
              Date Started: Oldest
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex h-10 items-center justify-end gap-2">
          {isFetching && !isLoading && (
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          )}
          <AddWorkflowDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="bg-muted/20 flex h-64 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
          <Workflow className="text-muted-foreground/50 size-10" />
          <h3 className="mt-4 text-lg font-semibold">No workflows found</h3>
          <p className="text-muted-foreground mt-2 max-w-xs text-sm">
            {search || workflowType !== "all" || agentFilter !== "all"
              ? "Try adjusting your filters."
              : "Workflow phases are created when providers are assigned to facilities."}
          </p>
        </div>
      ) : (
        <VirtualScrollContainer
          className="overflow-hidden"
          heightClassName="h-[calc(83vh)]"
          viewportClassName="workflows-scroll-viewport"
        >
          <div className="space-y-3 p-4">
          {visibleGroups.map((group) => {
            const isExpanded = expandedGroups.has(String(group.key));
            const progress =
              group.totalCount > 0
                ? Math.round((group.completedCount / group.totalCount) * 100)
                : 0;
            const dueTone = getWorkflowDueTone(group.phases);

            return (
              <div
                key={group.key}
                className={cn(
                  "bg-card overflow-hidden rounded-lg border",
                  WORKFLOW_TYPE_OUTLINE_STYLES[group.workflowType],
                )}
              >
                <button
                  className="hover:bg-muted/40 w-full p-4 text-left transition-colors"
                  onClick={() => toggleGroup(String(group.key))}
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                            {WORKFLOW_TYPE_LABELS[group.workflowType] ??
                              group.workflowType}
                          </p>
                          <h3 className="truncate text-base font-semibold">
                            {group.contextLabel}
                          </h3>
                        </div>
                        <div className="flex flex-wrap justify-start gap-2 sm:max-w-[50%] sm:justify-end">
                          {group.hasOverdue && (
                            <Badge className="h-5 border-red-500/25 bg-red-500/15 py-0 text-[10px] text-red-600">
                              OVERDUE
                            </Badge>
                          )}
                          {group.hasBlocked && (
                            <Badge className="h-5 border-amber-500/25 bg-amber-500/15 py-0 text-[10px] text-amber-600">
                              BLOCKED
                            </Badge>
                          )}
                          {group.incidentCount > 0 && (
                            <Badge className="h-5 gap-1 border-orange-500/25 bg-orange-500/15 py-0 text-[10px] text-orange-600">
                              <AlertTriangle className="size-2.5" />
                              {group.incidentCount} incident
                              {group.incidentCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              WORKFLOW_DUE_TONE_BAR_STYLES[dueTone],
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {group.completedCount}/{group.totalCount} phase
                          {group.totalCount !== 1 ? "s" : ""} done · Updated{" "}
                          {formatDate(
                            group.latestUpdate
                              ? String(group.latestUpdate)
                              : undefined,
                          )}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        "text-muted-foreground mt-1 size-4 shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-3">
                    <div className="mb-2 flex items-center justify-end">
                      <BulkIncidentDialog
                        phases={group.phases.map((p) => ({
                          id: String(p.id),
                          phaseName: String(p.phaseName),
                        }))}
                        agents={agentList}
                        onSuccess={() => void utils.workflows.list.invalidate()}
                      />
                    </div>
                    <Table className="[&_td]:py-3 [&_td:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th]:py-3 [&_th:first-child]:pl-0 [&_th:last-child]:pr-0">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Phase</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.phases.map((phase) => (
                          <TableRow
                            key={phase.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => setSelectedId(String(phase.id))}
                          >
                            <TableCell className="font-medium">
                              {String(phase.phaseName)}
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
                              {formatDate(
                                phase.startDate
                                  ? String(phase.startDate)
                                  : undefined,
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {phase.dueDate ? (
                                <span
                                  className={
                                    new Date(String(phase.dueDate)) <
                                      new Date() &&
                                    !(phase.status ?? "")
                                      .toLowerCase()
                                      .includes("complet")
                                      ? "font-medium text-red-500"
                                      : ""
                                  }
                                >
                                  {formatDate(String(phase.dueDate))}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-right text-xs">
                              {formatDate(
                                phase.updatedAt
                                  ? String(phase.updatedAt)
                                  : undefined,
                              )}
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
          <WorkflowAutoAdvance
            enabled={hasMoreGroups}
            onAdvance={() => {
              setVisibleCount((current) =>
                Math.min(current + WORKFLOW_BATCH_SIZE, filteredWorkflows.length),
              );
            }}
            resetKey={`${visibleCount}-${filteredWorkflows.length}`}
            rootSelector=".workflows-scroll-viewport"
          />
        </div>
      </VirtualScrollContainer>
      )}

      {false && filteredPhases.length > 0 && (
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <span>
            {
              filteredPhases.filter((w) => {
                const status = (w.status ?? "").toLowerCase();
                return (
                  Boolean(status.includes("complet")) ||
                  Boolean(status === "done")
                );
              }).length
            }{" "}
            completed
          </span>
          <span>·</span>
          <span>
            {
              filteredPhases.filter(
                (w) => (w.status ?? "").toLowerCase() === "blocked",
              ).length
            }{" "}
            blocked
          </span>
          <span>·</span>
          <span>
            {
              filteredPhases.filter((w) => {
                return Boolean(
                  w.dueDate &&
                  new Date(String(w.dueDate)) < new Date() &&
                  !(w.status ?? "").toLowerCase().includes("complet"),
                );
              }).length
            }{" "}
            overdue
          </span>
        </div>
      )}

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

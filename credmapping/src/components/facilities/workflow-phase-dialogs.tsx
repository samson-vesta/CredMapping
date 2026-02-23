"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { isValid, parse } from "date-fns";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DatePicker } from "~/components/ui/date-picker";
import { Dialog, DialogClose, DialogTrigger } from "~/components/ui/dialog";
import {
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "~/components/ui/app-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

// ─── Validation ─────────────────────────────────────────────────

const isoDate = z.string().min(1, "This date is required.").refine(
  (v) => isValid(parse(v, "yyyy-MM-dd", new Date())),
  { message: "Invalid date format." },
);

const isoDateOptional = z.string().refine(
  (v) => {
    if (!v) return true;
    return isValid(parse(v, "yyyy-MM-dd", new Date()));
  },
  { message: "Invalid date format." },
);

const workflowPhaseSchema = z
  .object({
    phaseName: z.string().min(1, "Phase name is required."),
    status: z.string(),
    startDate: isoDate,
    dueDate: isoDate,
    completedAt: isoDateOptional,
  })
  .refine((d) => d.dueDate >= d.startDate, {
    message: "Due date must be on or after the start date.",
    path: ["dueDate"],
  })
  .refine(
    (d) => {
      if (d.completedAt && d.startDate) return d.completedAt >= d.startDate;
      return true;
    },
    {
      message: "Completed date must be on or after the start date.",
      path: ["completedAt"],
    },
  );

type WfForm = { phaseName: string; status: string; startDate: string; dueDate: string; completedAt: string };

const wfFieldSchemas: Record<string, z.ZodTypeAny> = {
  phaseName: z.string().min(1, "Phase name is required."),
  startDate: isoDate,
  dueDate: isoDate,
  completedAt: isoDateOptional,
};

function validateWfField(
  field: string,
  value: string,
  form: WfForm,
  prev: Record<string, string>,
): Record<string, string> {
  const next = { ...prev };

  // Single-field validation
  const schema = wfFieldSchemas[field];
  if (schema) {
    const r = schema.safeParse(value);
    if (r.success) {
      delete next[field];
    } else {
      next[field] = r.error.issues[0]?.message ?? "Invalid value.";
    }
  } else {
    delete next[field];
  }

  // Cross-field: dueDate >= startDate
  const startDate = field === "startDate" ? value : form.startDate;
  const dueDate = field === "dueDate" ? value : form.dueDate;
  if (startDate && dueDate && dueDate < startDate) {
    next.dueDate = "Due date must be on or after the start date.";
  } else if (next.dueDate === "Due date must be on or after the start date.") {
    delete next.dueDate;
  }

  // Cross-field: completedAt >= startDate
  const completedAt = field === "completedAt" ? value : form.completedAt;
  if (completedAt && startDate && completedAt < startDate) {
    next.completedAt = "Completed date must be on or after the start date.";
  } else if (next.completedAt === "Completed date must be on or after the start date.") {
    delete next.completedAt;
  }

  return next;
}

// ─── Add Workflow Phase ─────────────────────────────────────────

export function AddWorkflowPhaseDialog({ relatedId }: { relatedId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    phaseName: "",
    status: "Pending",
    startDate: "",
    dueDate: "",
    completedAt: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.facilities.createWorkflowPhase.useMutation({
    onSuccess: () => {
      toast.success("Workflow phase added.");
      setOpen(false);
      setForm({ phaseName: "", status: "Pending", startDate: "", dueDate: "", completedAt: "" });
      setErrors({});
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: string, value: string) => {
    setForm((p) => {
      setErrors((prev) => validateWfField(field, value, p, prev));
      return { ...p, [field]: value };
    });
  };

  const submit = () => {
    const result = workflowPhaseSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key && !fieldErrors[String(key)]) fieldErrors[String(key)] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    mutation.mutate({
      relatedId,
      phaseName: form.phaseName.trim(),
      status: form.status.trim() || "Pending",
      startDate: form.startDate,
      dueDate: form.dueDate,
      completedAt: form.completedAt || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setForm({ phaseName: "", status: "Pending", startDate: "", dueDate: "", completedAt: "" }); setErrors({}); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" /> Add Phase
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add Workflow Phase</ModalTitle>
        </ModalHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phase name *</label>
              <Input
                value={form.phaseName}
                onChange={(e) => update("phaseName", e.target.value)}
                placeholder="e.g. Application Submitted"
                className={errors.phaseName ? "border-destructive" : ""}
              />
              {errors.phaseName && <p className="text-xs text-destructive">{errors.phaseName}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Input
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                placeholder="Pending"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start date *</label>
              <DatePicker
                value={form.startDate}
                onChange={(v) => update("startDate", v)}
                placeholder="Pick start date"
                clearable={false}
              />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Due date *</label>
              <DatePicker
                value={form.dueDate}
                onChange={(v) => update("dueDate", v)}
                placeholder="Pick due date"
                clearable={false}
              />
              {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Completed at</label>
            <DatePicker
              value={form.completedAt}
              onChange={(v) => update("completedAt", v)}
              placeholder="Pick completed date"
            />
            {errors.completedAt && <p className="text-xs text-destructive">{errors.completedAt}</p>}
          </div>
        </div>
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? "Adding…" : "Add Phase"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Delete Workflow Phase ──────────────────────────────────────

export function DeleteWorkflowPhaseButton({ phaseId, phaseName }: { phaseId: string; phaseName: string }) {
  const router = useRouter();

  const mutation = api.facilities.deleteWorkflowPhase.useMutation({
    onSuccess: () => {
      toast.success("Workflow phase deleted.");
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete workflow phase?</AlertDialogTitle>
          <AlertDialogDescription>
            The phase &quot;{phaseName}&quot; will be permanently removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate({ id: phaseId });
            }}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

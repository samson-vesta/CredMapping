"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

const isoDateOrEmpty = z.string().refine(
  (v) => {
    if (!v) return true;
    return isValid(parse(v, "yyyy-MM-dd", new Date()));
  },
  { message: "Invalid date format." },
);

const preliveSchema = z
  .object({
    priority: z.string(),
    goLiveDate: isoDateOrEmpty,
    boardMeetingDate: isoDateOrEmpty,
    credentialingDueDate: isoDateOrEmpty,
    tempsPossible: z.string(),
    rolesNeeded: z.string(),
    payorEnrollmentRequired: z.string(),
  })
  .refine(
    (d) => {
      if (d.credentialingDueDate && d.goLiveDate) {
        return d.credentialingDueDate <= d.goLiveDate;
      }
      return true;
    },
    {
      message: "Credentialing due date must be on or before the go-live date.",
      path: ["credentialingDueDate"],
    },
  );

/** Inline cross-field date validation */
function validatePreliveField(
  field: string,
  value: string,
  form: PreliveFormState,
  prev: Record<string, string>,
): Record<string, string> {
  const next = { ...prev };

  // Validate individual field date format
  if (field === "goLiveDate" || field === "boardMeetingDate" || field === "credentialingDueDate") {
    const r = isoDateOrEmpty.safeParse(value);
    if (r.success) {
      delete next[field];
    } else {
      next[field] = r.error.issues[0]?.message ?? "Invalid date.";
    }
  }

  // Cross-field check: credentialingDueDate <= goLiveDate
  const credDue = field === "credentialingDueDate" ? value : form.credentialingDueDate;
  const goLive = field === "goLiveDate" ? value : form.goLiveDate;
  if (credDue && goLive && credDue > goLive) {
    next.credentialingDueDate = "Credentialing due date must be on or before the go-live date.";
  } else if (next.credentialingDueDate === "Credentialing due date must be on or before the go-live date.") {
    delete next.credentialingDueDate;
  }

  return next;
}

// ─── Types ──────────────────────────────────────────────────────

interface PreliveFormState {
  priority: string;
  goLiveDate: string;
  boardMeetingDate: string;
  credentialingDueDate: string;
  tempsPossible: string; // "true" | "false" | ""
  rolesNeeded: string;
  payorEnrollmentRequired: string;
}

const blankForm: PreliveFormState = {
  priority: "",
  goLiveDate: "",
  boardMeetingDate: "",
  credentialingDueDate: "",
  tempsPossible: "",
  rolesNeeded: "",
  payorEnrollmentRequired: "",
};

function boolOrNull(val: string): boolean | null {
  if (val === "true") return true;
  if (val === "false") return false;
  return null;
}

function boolToStr(val: boolean | null): string {
  if (val === true) return "true";
  if (val === false) return "false";
  return "";
}

// ─── Shared form fields ─────────────────────────────────────────

function PreliveFields({
  form,
  update,
  errors,
}: {
  form: PreliveFormState;
  update: (field: keyof PreliveFormState, value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Priority</label>
          <Input
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
            placeholder="High / Medium / Low"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Go-live date</label>
          <DatePicker
            value={form.goLiveDate}
            onChange={(v) => update("goLiveDate", v)}
            placeholder="Pick go-live date"
          />
          {errors.goLiveDate && <p className="text-xs text-destructive">{errors.goLiveDate}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Board meeting date</label>
          <DatePicker
            value={form.boardMeetingDate}
            onChange={(v) => update("boardMeetingDate", v)}
            placeholder="Pick a date"
          />
          {errors.boardMeetingDate && <p className="text-xs text-destructive">{errors.boardMeetingDate}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Credentialing due date</label>
          <DatePicker
            value={form.credentialingDueDate}
            onChange={(v) => update("credentialingDueDate", v)}
            placeholder="Pick a date"
          />
          {errors.credentialingDueDate && <p className="text-xs text-destructive">{errors.credentialingDueDate}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Temps possible?</label>
          <select
            className="bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={form.tempsPossible}
            onChange={(e) => update("tempsPossible", e.target.value)}
          >
            <option value="">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Payor enrollment?</label>
          <select
            className="bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={form.payorEnrollmentRequired}
            onChange={(e) => update("payorEnrollmentRequired", e.target.value)}
          >
            <option value="">Unknown</option>
            <option value="true">Required</option>
            <option value="false">Not required</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Roles needed (comma-separated)</label>
        <Input
          value={form.rolesNeeded}
          onChange={(e) => update("rolesNeeded", e.target.value)}
          placeholder="Radiologist, Cardiologist"
        />
      </div>
    </div>
  );
}

// ─── Add Pre-live ───────────────────────────────────────────────

export function AddPreliveDialog({ facilityId }: { facilityId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PreliveFormState>(blankForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.facilities.createPrelive.useMutation({
    onSuccess: () => {
      toast.success("Pre-live record added.");
      setOpen(false);
      setForm(blankForm);
      setErrors({});
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof PreliveFormState, value: string) => {
    setForm((p) => {
      const updated = { ...p, [field]: value };
      setErrors((prev) => validatePreliveField(field, value, p, prev));
      return updated;
    });
  };

  const submit = () => {
    const result = preliveSchema.safeParse(form);
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

    const roles = form.rolesNeeded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    mutation.mutate({
      facilityId,
      priority: form.priority.trim() || undefined,
      goLiveDate: form.goLiveDate || undefined,
      boardMeetingDate: form.boardMeetingDate || undefined,
      credentialingDueDate: form.credentialingDueDate || undefined,
      tempsPossible: boolOrNull(form.tempsPossible),
      rolesNeeded: roles.length > 0 ? roles : undefined,
      payorEnrollmentRequired: boolOrNull(form.payorEnrollmentRequired),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setForm(blankForm); setErrors({}); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" /> Add Pre-live
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add Pre-live Record</ModalTitle>
        </ModalHeader>
        <PreliveFields form={form} update={update} errors={errors} />
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? "Adding…" : "Add Record"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Edit Pre-live ──────────────────────────────────────────────

interface PreliveData {
  id: string;
  priority: string | null;
  goLiveDate: string | null;
  boardMeetingDate: string | null;
  credentialingDueDate: string | null;
  tempsPossible: boolean | null;
  rolesNeeded: unknown;
  payorEnrollmentRequired: boolean | null;
}

function parseRoles(value: unknown): string {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(", ");
  if (typeof value === "string") return value;
  return "";
}

export function EditPreliveDialog({ prelive }: { prelive: PreliveData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initial: PreliveFormState = {
    priority: prelive.priority ?? "",
    goLiveDate: prelive.goLiveDate ?? "",
    boardMeetingDate: prelive.boardMeetingDate ?? "",
    credentialingDueDate: prelive.credentialingDueDate ?? "",
    tempsPossible: boolToStr(prelive.tempsPossible),
    rolesNeeded: parseRoles(prelive.rolesNeeded),
    payorEnrollmentRequired: boolToStr(prelive.payorEnrollmentRequired),
  };

  const [form, setForm] = useState<PreliveFormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.facilities.updatePrelive.useMutation({
    onSuccess: () => {
      toast.success("Pre-live record updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof PreliveFormState, value: string) => {
    setForm((p) => {
      const updated = { ...p, [field]: value };
      setErrors((prev) => validatePreliveField(field, value, p, prev));
      return updated;
    });
  };

  const submit = () => {
    const result = preliveSchema.safeParse(form);
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

    const roles = form.rolesNeeded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    mutation.mutate({
      id: prelive.id,
      priority: form.priority.trim() || undefined,
      goLiveDate: form.goLiveDate || undefined,
      boardMeetingDate: form.boardMeetingDate || undefined,
      credentialingDueDate: form.credentialingDueDate || undefined,
      tempsPossible: boolOrNull(form.tempsPossible),
      rolesNeeded: roles.length > 0 ? roles : undefined,
      payorEnrollmentRequired: boolOrNull(form.payorEnrollmentRequired),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setForm(initial); setErrors({}); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Edit Pre-live Record</ModalTitle>
        </ModalHeader>
        <PreliveFields form={form} update={update} errors={errors} />
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Delete Pre-live ────────────────────────────────────────────

export function DeletePreliveButton({ preliveId }: { preliveId: string }) {
  const router = useRouter();

  const mutation = api.facilities.deletePrelive.useMutation({
    onSuccess: () => {
      toast.success("Pre-live record removed.");
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
          <AlertDialogTitle>Delete pre-live record?</AlertDialogTitle>
          <AlertDialogDescription>
            This pre-live pipeline record will be permanently removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate({ id: preliveId });
            }}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

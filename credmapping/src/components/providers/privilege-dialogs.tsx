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

const privilegeSchema = z
  .object({
    privilegeTier: z.string(),
    currentPrivInitDate: isoDateOrEmpty,
    currentPrivEndDate: isoDateOrEmpty,
    termDate: isoDateOrEmpty,
    termReason: z.string(),
  })
  .refine(
    (d) => {
      if (d.currentPrivInitDate && d.currentPrivEndDate)
        return d.currentPrivEndDate >= d.currentPrivInitDate;
      return true;
    },
    {
      message: "End date must be on or after the init date.",
      path: ["currentPrivEndDate"],
    },
  );

type PrivilegeFormState = {
  privilegeTier: string;
  currentPrivInitDate: string;
  currentPrivEndDate: string;
  termDate: string;
  termReason: string;
};

const privilegeFieldSchemas: Record<string, z.ZodTypeAny> = {
  currentPrivInitDate: isoDateOrEmpty,
  currentPrivEndDate: isoDateOrEmpty,
  termDate: isoDateOrEmpty,
};

function validatePrivilegeField(
  field: string,
  value: string,
  form: PrivilegeFormState,
  prev: Record<string, string>,
): Record<string, string> {
  const next = { ...prev };

  const schema = privilegeFieldSchemas[field];
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

  // Cross-field: endDate >= initDate
  const initDate = field === "currentPrivInitDate" ? value : form.currentPrivInitDate;
  const endDate = field === "currentPrivEndDate" ? value : form.currentPrivEndDate;
  if (initDate && endDate && endDate < initDate) {
    next.currentPrivEndDate = "End date must be on or after the init date.";
  } else if (next.currentPrivEndDate === "End date must be on or after the init date.") {
    delete next.currentPrivEndDate;
  }

  return next;
}

const TIER_OPTIONS = ["Inactive", "Full", "Temp", "In Progress"] as const;
type TierOption = (typeof TIER_OPTIONS)[number];

const blankPrivilege: PrivilegeFormState = {
  privilegeTier: "",
  currentPrivInitDate: "",
  currentPrivEndDate: "",
  termDate: "",
  termReason: "",
};

// ─── Add Privilege Dialog ───────────────────────────────────────

export function AddPrivilegeDialog({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PrivilegeFormState>(blankPrivilege);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.providers.createPrivilege.useMutation({
    onSuccess: () => {
      toast.success("Privilege record added.");
      setOpen(false);
      setForm(blankPrivilege);
      setErrors({});
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof PrivilegeFormState, value: string) => {
    setForm((p) => {
      setErrors((prev) => validatePrivilegeField(field, value, p, prev));
      return { ...p, [field]: value };
    });
  };

  const submit = () => {
    const result = privilegeSchema.safeParse(form);
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

    const tier = form.privilegeTier as TierOption | "";

    mutation.mutate({
      providerId,
      privilegeTier: TIER_OPTIONS.includes(tier as TierOption) ? (tier as TierOption) : undefined,
      currentPrivInitDate: form.currentPrivInitDate || undefined,
      currentPrivEndDate: form.currentPrivEndDate || undefined,
      termDate: form.termDate || undefined,
      termReason: form.termReason.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setForm(blankPrivilege); setErrors({}); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" /> Add Privilege
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add Vesta Privilege</ModalTitle>
        </ModalHeader>
        <PrivilegeFields form={form} errors={errors} update={update} />
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? "Adding…" : "Add Privilege"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Edit Privilege Dialog ──────────────────────────────────────

interface EditPrivilegeDialogProps {
  privilege: {
    id: string;
    privilegeTier: TierOption | null;
    currentPrivInitDate: string | null;
    currentPrivEndDate: string | null;
    termDate: string | null;
    termReason: string | null;
  };
}

export function EditPrivilegeDialog({ privilege }: EditPrivilegeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initial: PrivilegeFormState = {
    privilegeTier: privilege.privilegeTier ?? "",
    currentPrivInitDate: privilege.currentPrivInitDate ?? "",
    currentPrivEndDate: privilege.currentPrivEndDate ?? "",
    termDate: privilege.termDate ?? "",
    termReason: privilege.termReason ?? "",
  };

  const [form, setForm] = useState<PrivilegeFormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.providers.updatePrivilege.useMutation({
    onSuccess: () => {
      toast.success("Privilege updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof PrivilegeFormState, value: string) => {
    setForm((p) => {
      setErrors((prev) => validatePrivilegeField(field, value, p, prev));
      return { ...p, [field]: value };
    });
  };

  const submit = () => {
    const result = privilegeSchema.safeParse(form);
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

    const tier = form.privilegeTier as TierOption | "";

    mutation.mutate({
      id: privilege.id,
      privilegeTier: TIER_OPTIONS.includes(tier as TierOption) ? (tier as TierOption) : null,
      currentPrivInitDate: form.currentPrivInitDate || undefined,
      currentPrivEndDate: form.currentPrivEndDate || undefined,
      termDate: form.termDate || undefined,
      termReason: form.termReason.trim() || undefined,
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
          <ModalTitle>Edit Vesta Privilege</ModalTitle>
        </ModalHeader>
        <PrivilegeFields form={form} errors={errors} update={update} />
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Delete Privilege Button ────────────────────────────────────

export function DeletePrivilegeButton({ privilegeId, tier }: { privilegeId: string; tier: string | null }) {
  const router = useRouter();

  const mutation = api.providers.deletePrivilege.useMutation({
    onSuccess: () => {
      toast.success("Privilege record deleted.");
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
          <AlertDialogTitle>Delete privilege record?</AlertDialogTitle>
          <AlertDialogDescription>
            The &quot;{tier ?? "Unspecified"}&quot; privilege record will be permanently removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate({ id: privilegeId });
            }}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Shared form fields ─────────────────────────────────────────

function PrivilegeFields({
  form,
  errors,
  update,
}: {
  form: PrivilegeFormState;
  errors: Record<string, string>;
  update: (field: keyof PrivilegeFormState, value: string) => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Privilege Tier</label>
        <select
          className="bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={form.privilegeTier}
          onChange={(e) => update("privilegeTier", e.target.value)}
        >
          <option value="">— Select —</option>
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Init date</label>
          <DatePicker
            value={form.currentPrivInitDate}
            onChange={(v) => update("currentPrivInitDate", v)}
            placeholder="Pick init date"
          />
          {errors.currentPrivInitDate && <p className="text-xs text-destructive">{errors.currentPrivInitDate}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">End date</label>
          <DatePicker
            value={form.currentPrivEndDate}
            onChange={(v) => update("currentPrivEndDate", v)}
            placeholder="Pick end date"
          />
          {errors.currentPrivEndDate && <p className="text-xs text-destructive">{errors.currentPrivEndDate}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Term date</label>
          <DatePicker
            value={form.termDate}
            onChange={(v) => update("termDate", v)}
            placeholder="Pick term date"
          />
          {errors.termDate && <p className="text-xs text-destructive">{errors.termDate}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Term reason</label>
          <Input
            value={form.termReason}
            onChange={(e) => update("termReason", e.target.value)}
            placeholder="Reason for termination"
          />
        </div>
      </div>
    </div>
  );
}

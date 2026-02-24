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

const licenseSchema = z
  .object({
    state: z.string().min(1, "State is required."),
    status: z.string(),
    path: z.string(),
    priority: z.string(),
    initialOrRenewal: z.string(),
    number: z.string(),
    startsAt: isoDateOrEmpty,
    expiresAt: isoDateOrEmpty,
  })
  .refine(
    (d) => {
      if (d.startsAt && d.expiresAt) return d.expiresAt >= d.startsAt;
      return true;
    },
    {
      message: "Expiration date must be on or after the start date.",
      path: ["expiresAt"],
    },
  );

/** Per-field schemas for inline validation */
const licenseFieldSchemas: Record<string, z.ZodTypeAny> = {
  state: z.string().max(2, "State must be a 2-letter code."),
  startsAt: isoDateOrEmpty,
  expiresAt: isoDateOrEmpty,
};

type LicenseFormState = {
  state: string;
  status: string;
  path: string;
  priority: string;
  initialOrRenewal: string;
  number: string;
  startsAt: string;
  expiresAt: string;
};

function validateLicenseField(
  field: string,
  value: string,
  form: LicenseFormState,
  prev: Record<string, string>,
): Record<string, string> {
  const next = { ...prev };

  // Single-field validation
  const schema = licenseFieldSchemas[field];
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

  // Cross-field: expiresAt >= startsAt
  const startsAt = field === "startsAt" ? value : form.startsAt;
  const expiresAt = field === "expiresAt" ? value : form.expiresAt;
  if (startsAt && expiresAt && expiresAt < startsAt) {
    next.expiresAt = "Expiration date must be on or after the start date.";
  } else if (next.expiresAt === "Expiration date must be on or after the start date.") {
    delete next.expiresAt;
  }

  return next;
}

const blankLicense: LicenseFormState = {
  state: "",
  status: "",
  path: "",
  priority: "",
  initialOrRenewal: "",
  number: "",
  startsAt: "",
  expiresAt: "",
};

// ─── Add License Dialog ─────────────────────────────────────────

export function AddLicenseDialog({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LicenseFormState>(blankLicense);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.providers.createLicense.useMutation({
    onSuccess: () => {
      toast.success("License added.");
      setOpen(false);
      setForm(blankLicense);
      setErrors({});
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof LicenseFormState, value: string) => {
    setForm((p) => {
      setErrors((prev) => validateLicenseField(field, value, p, prev));
      return { ...p, [field]: value };
    });
  };

  const submit = () => {
    const result = licenseSchema.safeParse(form);
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

    const ior = form.initialOrRenewal as "initial" | "renewal" | "";

    mutation.mutate({
      providerId,
      state: form.state.trim() || undefined,
      status: form.status.trim() || undefined,
      path: form.path.trim() || undefined,
      priority: form.priority.trim() || undefined,
      initialOrRenewal: ior === "initial" || ior === "renewal" ? ior : undefined,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
      number: form.number.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setForm(blankLicense); setErrors({}); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" /> Add License
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add State License</ModalTitle>
        </ModalHeader>
        <LicenseFields form={form} errors={errors} update={update} />
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? "Adding…" : "Add License"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Edit License Dialog ────────────────────────────────────────

interface EditLicenseDialogProps {
  license: {
    id: string;
    state: string | null;
    status: string | null;
    path: string | null;
    priority: string | null;
    initialOrRenewal: "initial" | "renewal" | null;
    expiresAt: string | null;
    startsAt: string | null;
    number: string | null;
  };
}

export function EditLicenseDialog({ license }: EditLicenseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initial: LicenseFormState = {
    state: license.state ?? "",
    status: license.status ?? "",
    path: license.path ?? "",
    priority: license.priority ?? "",
    initialOrRenewal: license.initialOrRenewal ?? "",
    number: license.number ?? "",
    startsAt: license.startsAt ?? "",
    expiresAt: license.expiresAt ?? "",
  };

  const [form, setForm] = useState<LicenseFormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.providers.updateLicense.useMutation({
    onSuccess: () => {
      toast.success("License updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof LicenseFormState, value: string) => {
    setForm((p) => {
      setErrors((prev) => validateLicenseField(field, value, p, prev));
      return { ...p, [field]: value };
    });
  };

  const submit = () => {
    const result = licenseSchema.safeParse(form);
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

    const ior = form.initialOrRenewal as "initial" | "renewal" | "";

    mutation.mutate({
      id: license.id,
      state: form.state.trim() || undefined,
      status: form.status.trim() || undefined,
      path: form.path.trim() || undefined,
      priority: form.priority.trim() || undefined,
      initialOrRenewal: ior === "initial" || ior === "renewal" ? ior : undefined,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
      number: form.number.trim() || undefined,
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
          <ModalTitle>Edit State License</ModalTitle>
        </ModalHeader>
        <LicenseFields form={form} errors={errors} update={update} />
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

// ─── Delete License Button ──────────────────────────────────────

export function DeleteLicenseButton({ licenseId, state }: { licenseId: string; state: string | null }) {
  const router = useRouter();

  const mutation = api.providers.deleteLicense.useMutation({
    onSuccess: () => {
      toast.success("License deleted.");
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
          <AlertDialogTitle>Delete license?</AlertDialogTitle>
          <AlertDialogDescription>
            The {state ?? "this"} state license will be permanently removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate({ id: licenseId });
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

function LicenseFields({
  form,
  errors,
  update,
}: {
  form: LicenseFormState;
  errors: Record<string, string>;
  update: (field: keyof LicenseFormState, value: string) => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">State</label>
          <Input
            value={form.state}
            maxLength={2}
            onChange={(e) => update("state", e.target.value.toUpperCase())}
            placeholder="TX"
            className={errors.state ? "border-destructive" : ""}
          />
          {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <Input
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            placeholder="Active"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">License number</label>
          <Input
            value={form.number}
            onChange={(e) => update("number", e.target.value)}
            placeholder="LIC-12345"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Priority</label>
          <Input
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
            placeholder="High"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Path</label>
          <Input
            value={form.path}
            onChange={(e) => update("path", e.target.value)}
            placeholder="e.g. Endorsement"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Initial / Renewal</label>
          <select
            className="bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={form.initialOrRenewal}
            onChange={(e) => update("initialOrRenewal", e.target.value)}
          >
            <option value="">—</option>
            <option value="initial">Initial</option>
            <option value="renewal">Renewal</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Starts at</label>
          <DatePicker
            value={form.startsAt}
            onChange={(v) => update("startsAt", v)}
            placeholder="Pick start date"
          />
          {errors.startsAt && <p className="text-xs text-destructive">{errors.startsAt}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Expires at</label>
          <DatePicker
            value={form.expiresAt}
            onChange={(v) => update("expiresAt", v)}
            placeholder="Pick expiry date"
          />
          {errors.expiresAt && <p className="text-xs text-destructive">{errors.expiresAt}</p>}
        </div>
      </div>
    </div>
  );
}

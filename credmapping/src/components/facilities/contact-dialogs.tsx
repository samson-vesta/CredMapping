"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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

const contactSchema = z.object({
  name: z.string().min(1, "Name is required."),
  title: z.string().optional(),
  email: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.union([
        z.literal(""),
        z.string().email("Please enter a valid email address."),
      ]),
    ),
  phone: z.string().optional(),
  isPrimary: z.boolean(),
});

/** Per-field schemas for instant inline validation */
const contactFieldSchemas: Record<string, z.ZodTypeAny> = {
  name: z.string().min(1, "Name is required."),
  email: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.union([
        z.literal(""),
        z.string().email("Please enter a valid email address."),
      ]),
    ),
};

function validateContactField(
  field: string,
  value: unknown,
  prev: Record<string, string>,
): Record<string, string> {
  const schema = contactFieldSchemas[field];
  if (!schema) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [field]: _, ...rest } = prev;
    return rest;
  }
  const result = schema.safeParse(value);
  if (result.success) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [field]: _, ...rest } = prev;
    return rest;
  }
  return { ...prev, [field]: result.error.issues[0]?.message ?? "Invalid value." };
}

// ─── Types ──────────────────────────────────────────────────────

interface ContactFormState {
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

const blankContact: ContactFormState = {
  name: "",
  title: "",
  email: "",
  phone: "",
  isPrimary: false,
};

// ─── Add Contact ────────────────────────────────────────────────

export function AddContactDialog({ facilityId }: { facilityId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContactFormState>(blankContact);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.facilities.createContact.useMutation({
    onSuccess: () => {
      toast.success("Contact added.");
      setOpen(false);
      setForm(blankContact);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof ContactFormState, value: string | boolean) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((prev) => validateContactField(field, value, prev));
  };

  const submit = () => {
    const result = contactSchema.safeParse(form);
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
      facilityId,
      name: form.name.trim(),
      title: form.title.trim() || undefined,
      email: form.email.trim() || "",
      phone: form.phone.trim() || undefined,
      isPrimary: form.isPrimary,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setForm(blankContact); setErrors({}); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" /> Add Contact
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add Contact</ModalTitle>
        </ModalHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name *</label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="John Doe" className={errors.name ? "border-destructive" : ""} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Credentialing Coord." />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="contact@facility.com" type="email" className={errors.email ? "border-destructive" : ""} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => update("isPrimary", e.target.checked)} className="accent-primary" />
            Primary contact
          </label>
        </div>
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? "Adding…" : "Add Contact"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Edit Contact ───────────────────────────────────────────────

interface EditContactDialogProps {
  contact: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean | null;
  };
}

export function EditContactDialog({ contact }: EditContactDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContactFormState>({
    name: contact.name,
    title: contact.title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    isPrimary: contact.isPrimary ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.facilities.updateContact.useMutation({
    onSuccess: () => {
      toast.success("Contact updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof ContactFormState, value: string | boolean) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((prev) => validateContactField(field, value, prev));
  };

  const submit = () => {
    const result = contactSchema.safeParse(form);
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
      id: contact.id,
      name: form.name.trim(),
      title: form.title.trim() || undefined,
      email: form.email.trim() || "",
      phone: form.phone.trim() || undefined,
      isPrimary: form.isPrimary,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setForm({
            name: contact.name,
            title: contact.title ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            isPrimary: contact.isPrimary ?? false,
          });
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Edit Contact</ModalTitle>
        </ModalHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name *</label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" className={errors.email ? "border-destructive" : ""} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => update("isPrimary", e.target.checked)} className="accent-primary" />
            Primary contact
          </label>
        </div>
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

// ─── Delete Contact ─────────────────────────────────────────────

export function DeleteContactButton({ contactId, contactName }: { contactId: string; contactName: string }) {
  const router = useRouter();

  const mutation = api.facilities.deleteContact.useMutation({
    onSuccess: () => {
      toast.success("Contact removed.");
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
          <AlertDialogTitle>Remove contact?</AlertDialogTitle>
          <AlertDialogDescription>
            Remove <strong>{contactName}</strong> from this facility? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate({ id: contactId });
            }}
          >
            {mutation.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Toggle Primary ─────────────────────────────────────────────

export function TogglePrimaryButton({
  contactId,
  isPrimary,
}: {
  contactId: string;
  isPrimary: boolean;
}) {
  const router = useRouter();

  const mutation = api.facilities.toggleContactPrimary.useMutation({
    onSuccess: () => {
      toast.success(isPrimary ? "Removed as primary." : "Set as primary.");
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      className={`h-7 w-7 p-0 ${isPrimary ? "text-emerald-400" : "text-muted-foreground"}`}
      disabled={mutation.isPending}
      onClick={() => { mutation.mutate({ id: contactId, isPrimary: !isPrimary }); }}
      title={isPrimary ? "Remove primary" : "Set as primary"}
    >
      <Star className={`size-3.5 ${isPrimary ? "fill-emerald-400" : ""}`} />
    </Button>
  );
}

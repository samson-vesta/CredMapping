"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Dialog, DialogClose, DialogTrigger } from "~/components/ui/dialog";
import {
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "~/components/ui/app-modal";
import { api } from "~/trpc/react";

// ─── Validation ─────────────────────────────────────────────────

const providerSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required."),
  degree: z.string().optional(),
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
  notes: z.string().optional(),
});

/** Per-field schemas for instant inline validation */
const providerFieldSchemas: Record<string, z.ZodTypeAny> = {
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
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

function validateProviderField(
  field: string,
  value: unknown,
  prev: Record<string, string>,
): Record<string, string> {
  const schema = providerFieldSchemas[field];
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

interface EditProviderDialogProps {
  provider: {
    id: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    degree: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
}

type ProviderForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  degree: string;
  email: string;
  phone: string;
  notes: string;
};

// ─── Component ──────────────────────────────────────────────────

export function EditProviderDialog({ provider }: EditProviderDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProviderForm>({
    firstName: provider.firstName ?? "",
    middleName: provider.middleName ?? "",
    lastName: provider.lastName ?? "",
    degree: provider.degree ?? "",
    email: provider.email ?? "",
    phone: provider.phone ?? "",
    notes: provider.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.providers.updateProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const updateField = (field: keyof ProviderForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => validateProviderField(field, value, prev));
  };

  const handleSubmit = () => {
    const result = providerSchema.safeParse(form);
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
      id: provider.id,
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      degree: form.degree.trim() || undefined,
      email: form.email.trim() || "",
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const resetForm = () => ({
    firstName: provider.firstName ?? "",
    middleName: provider.middleName ?? "",
    lastName: provider.lastName ?? "",
    degree: provider.degree ?? "",
    email: provider.email ?? "",
    phone: provider.phone ?? "",
    notes: provider.notes ?? "",
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setForm(resetForm());
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Pencil className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>

      <ModalContent>
        <ModalHeader>
          <ModalTitle>Edit Provider</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">First Name *</label>
              <Input
                value={form.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                placeholder="Jane"
                className={errors.firstName ? "border-destructive" : ""}
              />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Middle Name</label>
              <Input
                value={form.middleName}
                onChange={(e) => updateField("middleName", e.target.value)}
                placeholder="A."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Last Name *</label>
              <Input
                value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                placeholder="Doe"
                className={errors.lastName ? "border-destructive" : ""}
              />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Degree</label>
              <Input
                value={form.degree}
                onChange={(e) => updateField("degree", e.target.value)}
                placeholder="MD"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="jane.doe@example.com"
                type="email"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              className="min-h-20"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Any extra notes about this provider"
            />
          </div>
        </div>

        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

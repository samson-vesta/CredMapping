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

const facilitySchema = z.object({
  name: z.string().min(1, "Facility name is required."),
  state: z.string().max(2, "State must be a 2-letter code.").optional(),
  email: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.union([
        z.literal(""),
        z.string().email("Please enter a valid email address."),
      ]),
    ),
  address: z.string().optional(),
  proxy: z.string().optional(),
  tatSla: z.string().optional(),
  status: z.enum(["Active", "Inactive", "In Progress"]),
  yearlyVolume: z.string().refine(
    (v) => {
      if (!v.trim()) return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0;
    },
    { message: "Yearly volume must be a non-negative number." },
  ),
  modalities: z.string(),
});

/** Per-field schemas for instant inline validation */
const facilityFieldSchemas: Record<string, z.ZodTypeAny> = {
  name: z.string().min(1, "Facility name is required."),
  state: z.string().max(2, "State must be a 2-letter code."),
  email: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.union([
        z.literal(""),
        z.string().email("Please enter a valid email address."),
      ]),
    ),
  yearlyVolume: z.string().refine(
    (v) => {
      if (!v.trim()) return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0;
    },
    { message: "Yearly volume must be a non-negative number." },
  ),
};

function validateFacilityField(
  field: string,
  value: unknown,
  prev: Record<string, string>,
): Record<string, string> {
  const schema = facilityFieldSchemas[field];
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

interface EditFacilityDialogProps {
  facility: {
    id: string;
    name: string | null;
    state: string | null;
    proxy: string | null;
    status: "Active" | "Inactive" | "In Progress" | null;
    email: string | null;
    address: string | null;
    yearlyVolume: number | null;
    modalities: string[] | null;
    tatSla: string | null;
  };
}

type FacilityForm = {
  name: string;
  state: string;
  email: string;
  address: string;
  proxy: string;
  tatSla: string;
  status: "Active" | "Inactive" | "In Progress";
  yearlyVolume: string;
  modalities: string;
};

export function EditFacilityDialog({ facility }: EditFacilityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FacilityForm>({
    name: facility.name ?? "",
    state: facility.state ?? "",
    email: facility.email ?? "",
    address: facility.address ?? "",
    proxy: facility.proxy ?? "",
    tatSla: facility.tatSla ?? "",
    status: facility.status ?? "Active",
    yearlyVolume: facility.yearlyVolume?.toString() ?? "",
    modalities: facility.modalities?.join(", ") ?? "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = api.facilities.updateFacility.useMutation({
    onSuccess: () => {
      toast.success("Facility updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const updateField = (field: keyof FacilityForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => validateFacilityField(field, value, prev));
  };

  const handleSubmit = () => {
    const result = facilitySchema.safeParse(form);
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

    const vol = form.yearlyVolume.trim();
    const parsedVol = vol ? parseInt(vol, 10) : null;

    const mods = form.modalities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    mutation.mutate({
      id: facility.id,
      name: form.name.trim(),
      state: form.state.trim() || undefined,
      email: form.email.trim() || "",
      address: form.address.trim() || undefined,
      proxy: form.proxy.trim() || undefined,
      tatSla: form.tatSla.trim() || undefined,
      status: form.status,
      yearlyVolume: parsedVol,
      modalities: mods.length > 0 ? mods : null,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setForm({
            name: facility.name ?? "",
            state: facility.state ?? "",
            email: facility.email ?? "",
            address: facility.address ?? "",
            proxy: facility.proxy ?? "",
            tatSla: facility.tatSla ?? "",
            status: facility.status ?? "Active",
            yearlyVolume: facility.yearlyVolume?.toString() ?? "",
            modalities: facility.modalities?.join(", ") ?? "",
          });
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
          <ModalTitle>Edit Facility</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium">Facility Name *</label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Facility name"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">State</label>
              <Input
                value={form.state}
                maxLength={2}
                onChange={(e) => updateField("state", e.target.value.toUpperCase())}
                placeholder="TX"
                className={errors.state ? "border-destructive" : ""}
              />
              {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <select
                className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as FacilityForm["status"])
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Proxy</label>
              <Input
                value={form.proxy}
                onChange={(e) => updateField("proxy", e.target.value)}
                placeholder="Vesta"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Yearly Volume</label>
              <Input
                value={form.yearlyVolume}
                onChange={(e) => updateField("yearlyVolume", e.target.value)}
                placeholder="10000"
                type="number"
                className={errors.yearlyVolume ? "border-destructive" : ""}
              />
              {errors.yearlyVolume && <p className="text-xs text-destructive">{errors.yearlyVolume}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="facility@example.com"
              type="email"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Address</label>
            <Textarea
              className="min-h-20"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Street, City, State ZIP"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">TAT SLA</label>
            <Input
              value={form.tatSla}
              onChange={(e) => updateField("tatSla", e.target.value)}
              placeholder="24-48 hours"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Modalities (comma-separated)</label>
            <Input
              value={form.modalities}
              onChange={(e) => updateField("modalities", e.target.value)}
              placeholder="CT, MRI, X-Ray"
            />
          </div>
        </div>

        <ModalFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button disabled={mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

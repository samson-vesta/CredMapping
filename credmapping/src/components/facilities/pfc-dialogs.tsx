"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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

// ─── Types ──────────────────────────────────────────────────────

type FormSize = "small" | "medium" | "large" | "x-large" | "online";

interface PfcFormState {
  facilityType: string;
  privileges: string;
  decision: string;
  notes: string;
  priority: string;
  formSize: FormSize | "";
  applicationRequired: string; // "true" | "false" | ""
}

const blankForm: PfcFormState = {
  facilityType: "",
  privileges: "",
  decision: "",
  notes: "",
  priority: "",
  formSize: "",
  applicationRequired: "",
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

function PfcFields({
  form,
  update,
}: {
  form: PfcFormState;
  update: (field: keyof PfcFormState, value: string) => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Facility type</label>
          <Input
            value={form.facilityType}
            onChange={(e) => update("facilityType", e.target.value)}
            placeholder="Hospital, Clinic, etc."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Priority</label>
          <Input
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
            placeholder="High / Medium / Low"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Privileges</label>
          <Input
            value={form.privileges}
            onChange={(e) => update("privileges", e.target.value)}
            placeholder="Full, Temp, etc."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Decision</label>
          <Input
            value={form.decision}
            onChange={(e) => update("decision", e.target.value)}
            placeholder="Approved, Pending, etc."
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Form size</label>
          <select
            className="bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={form.formSize}
            onChange={(e) => update("formSize", e.target.value)}
          >
            <option value="">Not set</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="x-large">X-Large</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Application required?</label>
          <select
            className="bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={form.applicationRequired}
            onChange={(e) => update("applicationRequired", e.target.value)}
          >
            <option value="">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <Textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
          placeholder="Any additional notes…"
        />
      </div>
    </div>
  );
}

// ─── Add PFC ────────────────────────────────────────────────────

export function AddPfcDialog({
  facilityId,
  providers,
}: {
  facilityId: string;
  providers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PfcFormState>(blankForm);
  const [selectedProviderId, setSelectedProviderId] = useState("");

  const mutation = api.facilities.createPfc.useMutation({
    onSuccess: () => {
      toast.success("Provider credential link created.");
      setOpen(false);
      setForm(blankForm);
      setSelectedProviderId("");
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof PfcFormState, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const submit = () => {
    if (!selectedProviderId) {
      toast.error("Select a provider to link.");
      return;
    }
    mutation.mutate({
      facilityId,
      providerId: selectedProviderId,
      facilityType: form.facilityType.trim() || undefined,
      privileges: form.privileges.trim() || undefined,
      decision: form.decision.trim() || undefined,
      notes: form.notes.trim() || undefined,
      priority: form.priority.trim() || undefined,
      formSize: (form.formSize as FormSize) || undefined,
      applicationRequired: boolOrNull(form.applicationRequired),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setForm(blankForm);
          setSelectedProviderId("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" /> Link Provider
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Link Provider Credential</ModalTitle>
        </ModalHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Provider *</label>
            <select
              className="bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
            >
              <option value="">Select a provider…</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <PfcFields form={form} update={update} />
        <ModalFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={mutation.isPending ? true : selectedProviderId === ""} onClick={submit}>
            {mutation.isPending ? "Linking…" : "Link Provider"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

// ─── Edit PFC ───────────────────────────────────────────────────

interface PfcData {
  id: string;
  facilityType: string | null;
  privileges: string | null;
  decision: string | null;
  notes: string | null;
  priority: string | null;
  formSize: FormSize | null;
  applicationRequired: boolean | null;
}

export function EditPfcDialog({ pfc }: { pfc: PfcData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initial: PfcFormState = {
    facilityType: pfc.facilityType ?? "",
    privileges: pfc.privileges ?? "",
    decision: pfc.decision ?? "",
    notes: pfc.notes ?? "",
    priority: pfc.priority ?? "",
    formSize: pfc.formSize ?? "",
    applicationRequired: boolToStr(pfc.applicationRequired),
  };

  const [form, setForm] = useState<PfcFormState>(initial);

  const mutation = api.facilities.updatePfc.useMutation({
    onSuccess: () => {
      toast.success("Provider credential updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const update = (field: keyof PfcFormState, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const submit = () => {
    mutation.mutate({
      id: pfc.id,
      facilityType: form.facilityType.trim() || undefined,
      privileges: form.privileges.trim() || undefined,
      decision: form.decision.trim() || undefined,
      notes: form.notes.trim() || undefined,
      priority: form.priority.trim() || undefined,
      formSize: (form.formSize as FormSize) || undefined,
      applicationRequired: boolOrNull(form.applicationRequired),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setForm(initial);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2">
          <Pencil className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Edit Provider Credential</ModalTitle>
        </ModalHeader>
        <PfcFields form={form} update={update} />
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

// ─── Delete PFC ─────────────────────────────────────────────────

export function DeletePfcButton({ pfcId, providerName }: { pfcId: string; providerName: string }) {
  const router = useRouter();

  const mutation = api.facilities.deletePfc.useMutation({
    onSuccess: () => {
      toast.success("Provider credential link removed.");
      router.refresh();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" /> Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove provider credential?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the credential link for <strong>{providerName}</strong> and
            all associated workflow phases. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate({ id: pfcId });
            }}
          >
            {mutation.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

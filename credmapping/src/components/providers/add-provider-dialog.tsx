"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

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

type AddProviderForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  degree: string;
  email: string;
  phone: string;
  notes: string;
};

const initialFormState: AddProviderForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  degree: "",
  email: "",
  phone: "",
  notes: "",
};

export function AddProviderDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddProviderForm>(initialFormState);

  const createProviderMutation = api.superadmin.createProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider added successfully.");
      setOpen(false);
      setForm(initialFormState);
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateField = (field: keyof AddProviderForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = () => {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();

    if (!firstName || !lastName) {
      toast.error("First and last name are required.");
      return;
    }

    createProviderMutation.mutate({
      firstName,
      middleName: form.middleName.trim() || undefined,
      lastName,
      degree: form.degree.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          setForm(initialFormState);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className={`h-8.5 gap-2 ${triggerClassName ?? ""}`.trim()} size="sm">
          <Plus className="h-6 w-4" />
          Add Provider
        </Button>
      </DialogTrigger>

      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add Provider</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="provider-first-name">
                First Name
              </label>
              <Input
                id="provider-first-name"
                onChange={(event) => updateField("firstName", event.target.value)}
                placeholder="Jane"
                value={form.firstName}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="provider-middle-name">
                Middle Name (optional)
              </label>
              <Input
                id="provider-middle-name"
                onChange={(event) => updateField("middleName", event.target.value)}
                placeholder="A."
                value={form.middleName}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="provider-last-name">
                Last Name
              </label>
              <Input
                id="provider-last-name"
                onChange={(event) => updateField("lastName", event.target.value)}
                placeholder="Doe"
                value={form.lastName}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="provider-degree">
                Degree (optional)
              </label>
              <Input
                id="provider-degree"
                onChange={(event) => updateField("degree", event.target.value)}
                placeholder="MD"
                value={form.degree}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="provider-email">
                Email (optional)
              </label>
              <Input
                id="provider-email"
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="jane.doe@example.com"
                type="email"
                value={form.email}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="provider-phone">
                Phone (optional)
              </label>
              <Input
                id="provider-phone"
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="(555) 123-4567"
                value={form.phone}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="provider-notes">
              Notes (optional)
            </label>
            <Textarea
              className="min-h-24"
              id="provider-notes"
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Any onboarding notes for this provider"
              value={form.notes}
            />
          </div>
        </div>

        <ModalFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={createProviderMutation.isPending}
            onClick={handleSubmit}
            type="button"
          >
            {createProviderMutation.isPending ? "Adding…" : "Add Provider"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

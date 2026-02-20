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

type AddFacilityForm = {
  name: string;
  state: string;
  email: string;
  address: string;
  proxy: string;
  tatSla: string;
};

const initialFormState: AddFacilityForm = {
  name: "",
  state: "",
  email: "",
  address: "",
  proxy: "",
  tatSla: "",
};

export function AddFacilityDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddFacilityForm>(initialFormState);

  const createFacilityMutation = api.superadmin.createFacility.useMutation({
    onSuccess: () => {
      toast.success("Facility added successfully.");
      setOpen(false);
      setForm(initialFormState);
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateField = (field: keyof AddFacilityForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = () => {
    const name = form.name.trim();

    if (!name) {
      toast.error("Facility name is required.");
      return;
    }

    createFacilityMutation.mutate({
      name,
      state: form.state.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      proxy: form.proxy.trim() || undefined,
      tatSla: form.tatSla.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setForm(initialFormState);
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-8.5 gap-2" size="sm">
          <Plus className="h-6 w-4" />
          Add Facility
        </Button>
      </DialogTrigger>

      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add Facility</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="facility-name">
                Facility Name
              </label>
              <Input
                id="facility-name"
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Example Medical Center"
                value={form.name}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="facility-state">
                State (optional)
              </label>
              <Input
                id="facility-state"
                maxLength={2}
                onChange={(event) => updateField("state", event.target.value.toUpperCase())}
                placeholder="TX"
                value={form.state}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="facility-proxy">
                Proxy (optional)
              </label>
              <Input
                id="facility-proxy"
                onChange={(event) => updateField("proxy", event.target.value)}
                placeholder="Vesta"
                value={form.proxy}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="facility-email">
              Email (optional)
            </label>
            <Input
              id="facility-email"
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="facility@example.com"
              type="email"
              value={form.email}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="facility-address">
              Address (optional)
            </label>
            <Textarea
              className="min-h-20"
              id="facility-address"
              onChange={(event) => updateField("address", event.target.value)}
              placeholder="Street, City, State ZIP"
              value={form.address}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="facility-tat-sla">
              TAT SLA (optional)
            </label>
            <Input
              id="facility-tat-sla"
              onChange={(event) => updateField("tatSla", event.target.value)}
              placeholder="24-48 hours"
              value={form.tatSla}
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
            disabled={createFacilityMutation.isPending}
            onClick={handleSubmit}
            type="button"
          >
            {createFacilityMutation.isPending ? "Adding…" : "Add Facility"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Dialog>
  );
}

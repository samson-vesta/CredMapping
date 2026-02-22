"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose } from "~/components/ui/dialog";
import {
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "~/components/ui/app-modal";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

interface EditableLog {
  id: string;
  commType: string | null;
  subject: string | null;
  notes: string | null;
  status: string | null;
  nextFollowupAt: Date | string | null;
}

interface NewLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  relatedId: string;
  relatedType: "provider" | "facility";
  editingLog?: EditableLog | null;
  onLogCreated?: () => void | Promise<void>;
}

const defaultFormData = {
  commType: "Email",
  subject: "",
  notes: "",
  status: "pending_response",
  nextFollowupAt: "",
};

const formatDateForInput = (value: Date | string | null | undefined) => {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0] ?? "";
};

export function NewLogModal({
  isOpen,
  onClose,
  relatedId,
  relatedType,
  editingLog,
  onLogCreated,
}: NewLogModalProps) {
  const [formData, setFormData] = useState(defaultFormData);
  const [activeEditingLog, setActiveEditingLog] = useState<EditableLog | null>(null);

  const isEditMode = Boolean(activeEditingLog);

  useEffect(() => {
    if (!isOpen) return;

    if (editingLog) {
      setActiveEditingLog(editingLog);
      setFormData({
        commType: editingLog.commType ?? "Email",
        subject: editingLog.subject ?? "",
        notes: editingLog.notes ?? "",
        status: editingLog.status ?? "pending_response",
        nextFollowupAt: formatDateForInput(editingLog.nextFollowupAt),
      });
      return;
    }

    setActiveEditingLog(null);
    setFormData(defaultFormData);
  }, [editingLog, isOpen]);

  const createMutation = api.commLogs.create.useMutation();
  const updateMutation = api.commLogs.update.useMutation();

  const isSubmitting = useMemo(
    () => createMutation.isPending || updateMutation.isPending,
    [createMutation.isPending, updateMutation.isPending],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (activeEditingLog) {
        await updateMutation.mutateAsync({
          id: activeEditingLog.id,
          ...formData,
        });
      } else {
        await createMutation.mutateAsync({
          relatedType,
          relatedId,
          ...formData,
        });
      }

      setFormData(defaultFormData);
      await onLogCreated?.();
      onClose();
    } catch (error) {
      console.error("Failed to save log:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>
            {isEditMode ? "Edit Communication Log" : "New Communication Log"}
          </ModalTitle>
        </ModalHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Communication Type
            </label>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-ring focus:outline-none"
              onChange={(e) => setFormData({ ...formData, commType: e.target.value })}
              value={formData.commType}
            >
              <option>Email</option>
              <option>Phone Call</option>
              <option>Dropbox</option>
              <option>Document</option>
              <option>Modio</option>
              {relatedType === "facility" && <option>Meeting</option>}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">Subject</label>
            <Input
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email subject or brief description"
              value={formData.subject}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Notes / Description
            </label>
            <Textarea
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Details about the communication"
              rows={4}
              value={formData.notes}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">Status</label>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-ring focus:outline-none"
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              value={formData.status}
            >
              <option value="pending_response">Pending Response</option>
              <option value="fu_completed">Follow-up Completed</option>
              <option value="received">Received</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Next Follow-up Date
            </label>
            <Input
              onChange={(e) =>
                setFormData({ ...formData, nextFollowupAt: e.target.value })
              }
              type="date"
              value={formData.nextFollowupAt}
            />
          </div>

          <ModalFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting
                ? isEditMode
                  ? "Saving..."
                  : "Creating..."
                : isEditMode
                  ? "Save Changes"
                  : "Create Log"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Dialog>
  );
}

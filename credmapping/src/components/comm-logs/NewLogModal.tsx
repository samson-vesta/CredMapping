"use client";

import { useEffect, useState } from "react";
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
      });
      return;
    }

    setActiveEditingLog(null);
    setFormData(defaultFormData);
  }, [editingLog, isOpen]);

  const createMutation = api.commLogs.create.useMutation();
  const updateMutation = api.commLogs.update.useMutation();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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
          <ModalTitle className="text-xl font-bold">
            {isEditMode ? "Edit Interaction Entry" : "Log New Interaction"}
          </ModalTitle>
        </ModalHeader>

        <form className="space-y-6 py-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Method
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Subject
              </label>
              <Input
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., PSV Follow-up"
                value={formData.subject}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Conversation Notes
            </label>
            <Textarea
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="What was discussed or what happened?"
              rows={6}
              value={formData.notes}
              className="resize-none"
              required
            />
          </div>

          <ModalFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={isSubmitting} type="submit" className="min-w-25">
              {isSubmitting ? (
                 "Saving..."
              ) : isEditMode ? (
                "Save Changes"
              ) : (
                "Post Entry"
              )}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Dialog>
  );
}

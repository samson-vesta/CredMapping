"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api } from "~/trpc/react";

interface NewLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  relatedId: string;
  relatedType: "provider" | "facility";
  onLogCreated?: () => void;
}

export function NewLogModal({
  isOpen,
  onClose,
  relatedId,
  relatedType,
  onLogCreated,
}: NewLogModalProps) {
  const [formData, setFormData] = useState({
    commType: "Email",
    subject: "",
    notes: "",
    status: "pending_response",
    nextFollowupAt: "",
  });

  const createMutation = api.commLogs.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        relatedType,
        relatedId,
        ...formData,
      });
      
      setFormData({
        commType: "Email",
        subject: "",
        notes: "",
        status: "pending_response",
        nextFollowupAt: "",
      });
      
      onLogCreated?.();
      onClose();
    } catch (error) {
      console.error("Failed to create log:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#181a1b] rounded-lg border border-zinc-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">New Communication Log</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-2">
              Communication Type
            </label>
            <select
              value={formData.commType}
              onChange={(e) =>
                setFormData({ ...formData, commType: e.target.value })
              }
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-ring"
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
            <label className="block text-sm font-medium text-zinc-200 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="Email subject or brief description"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-2">
              Notes / Description
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Details about the communication"
              rows={4}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-ring"
            >
              <option value="pending_response">Pending Response</option>
              <option value="fu_completed">Follow-up Completed</option>
              <option value="received">Received</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-2">
              Next Follow-up Date
            </label>
            <input
              type="date"
              value={formData.nextFollowupAt}
              onChange={(e) =>
                setFormData({ ...formData, nextFollowupAt: e.target.value })
              }
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-ring"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

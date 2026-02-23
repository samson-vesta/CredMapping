"use client";

import { format } from "date-fns";
import { FileText, Link as LinkIcon, Mail, Package, Phone, Users } from "lucide-react";

interface CommLogCardProps {
  id: string;
  commType: string | null;
  subject: string | null;
  notes: string | null;
  status: string | null;
  createdAt: Date | string | null;
  nextFollowupAt: Date | string | null;
  createdByName: string | null;
  lastUpdatedByName: string | null;
  onClick?: () => void;
}

const commTypeIcons: Record<string, React.ReactNode> = {
  Email: <Mail className="w-5 h-5" />,
  Phone: <Phone className="w-5 h-5" />,
  "Phone Call": <Phone className="w-5 h-5" />,
  Dropbox: <Package className="w-5 h-5" />,
  Document: <FileText className="w-5 h-5" />,
  Modio: <LinkIcon className="w-5 h-5" />,
  Meeting: <Users className="w-5 h-5" />,
};

const statusColors: Record<string, string> = {
  pending_response: "bg-yellow-500/15 text-yellow-400",
  fu_completed: "bg-green-500/15 text-green-400",
  received: "bg-blue-500/15 text-blue-400",
  closed: "bg-zinc-500/15 text-zinc-400",
};

export function CommLogCard({
  commType,
  subject,
  notes,
  status,
  createdAt,
  nextFollowupAt,
  createdByName,
  lastUpdatedByName,
  onClick,
}: CommLogCardProps) {
  const icon = commTypeIcons[commType ?? ""] ?? <FileText className="w-5 h-5" />;
  const statusColor = statusColors[status ?? ""] ?? "bg-zinc-700 text-zinc-400";

  return (
    <button
      className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-zinc-600"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0 text-zinc-400">{icon}</div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="truncate font-medium text-white">{subject ?? "Untitled"}</h4>
              <p className="mt-1 text-sm text-zinc-400">
                {format(new Date(createdAt ?? new Date()), "MMM d, yyyy HH:mm")}
              </p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${statusColor}`}
            >
              {status?.replace(/_/g, " ") ?? "Unknown"}
            </span>
          </div>

          {notes && <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{notes}</p>}

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              {nextFollowupAt && (
                <span className="rounded bg-zinc-800 px-2 py-1">
                  Follow-up: {format(new Date(nextFollowupAt), "MMM d")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {createdByName && (
                <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-300">
                  Created by: {createdByName}
                </span>
              )}
              {lastUpdatedByName && (
                <span className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-violet-300">
                  Updated by: {lastUpdatedByName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

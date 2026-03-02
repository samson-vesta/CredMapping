"use client";

import { format } from "date-fns";
import { FileText, Link as LinkIcon, Mail, Package, Phone, Users, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface CommLogCardProps {
  id: string;
  commType: string | null;
  subject: string | null;
  notes: string | null;
  createdAt: Date | string | null;
  createdByName: string | null;
  lastUpdatedByName: string | null;
  onClick?: () => void;
}

const commTypeIcons: Record<string, React.ReactNode> = {
  Email: <Mail className="w-4 h-4" />,
  Phone: <Phone className="w-4 h-4" />,
  "Phone Call": <Phone className="w-4 h-4" />,
  Dropbox: <Package className="w-4 h-4" />,
  Document: <FileText className="w-4 h-4" />,
  Modio: <LinkIcon className="w-4 h-4" />,
  Meeting: <Users className="w-4 h-4" />,
};

export function CommLogCard({
  commType,
  subject,
  notes,
  createdAt,
  createdByName,
  lastUpdatedByName,
  onClick,
}: CommLogCardProps) {
  const icon = commTypeIcons[commType ?? ""] ?? <FileText className="w-4 h-4" />;
  const commTypeLabel = commType ?? "Note";

  return (
    <button
      className="w-full rounded-xl border border-border bg-card/50 p-4 text-left transition-all hover:border-primary/30 hover:bg-muted/10 group shadow-sm"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="truncate font-bold text-sm text-foreground">
                {subject ?? "Untitled Interaction"}
              </h4>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                {format(new Date(createdAt ?? new Date()), "MMM d, yyyy · p")}
              </div>
            </div>

            <div className="shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      {icon}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" align="start">
                    {commTypeLabel}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {notes && (
            <p className="mt-3 line-clamp-3 text-sm text-muted-foreground leading-relaxed italic border-l-2 border-border pl-3">
              &quot;{notes}&quot;
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px]">
            <div className="flex items-center gap-2">
              {createdByName && (
                <span className="font-semibold text-muted-foreground/60">
                  Logged by: <span className="text-foreground">{createdByName}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {lastUpdatedByName && (
                <span className="font-semibold text-muted-foreground/60">
                  Last updated by: <span className="text-foreground">{lastUpdatedByName}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

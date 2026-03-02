"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ActionBadge } from "~/components/audit-log/ActionBadge";
import { DiffPanel } from "~/components/audit-log/DiffPanel";
import { cn } from "~/lib/utils";

interface AuditLogRowProps {
  timestamp: Date;
  user: string | null;
  action: "insert" | "update" | "delete";
  tableName: string;
  recordId: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function getRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins + "m ago";
  if (hours < 24) return hours + "h ago";
  return days + "d ago";
}

function computeChangedFields(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined
): string[] {
  if (!oldData && !newData) return [];
  const old = oldData ?? {};
  const new_ = newData ?? {};
  const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);

  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  allKeys.forEach((key) => {
    if (!(key in old)) added.push(key);
    else if (!(key in new_)) removed.push(key);
    else if (JSON.stringify(old[key]) !== JSON.stringify(new_[key]))
      changed.push(key);
  });

  return [...changed, ...added, ...removed];
}

function RecordIdCell({ recordId }: { recordId: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!recordId)
    return <span className="text-muted-foreground/40">—</span>;

  const truncated = recordId.slice(0, 18) + "...";

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); 
    void navigator.clipboard.writeText(recordId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 group cursor-default">
           
            <span className="font-mono text-xs text-muted-foreground">
              {truncated}
            </span>
        
            <button
              onClick={handleCopy}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy full ID"
              type="button"
            >
              {copied ? (
               
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-green-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
               
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="font-mono text-xs max-w-xs break-all"
        >
          <p className="text-muted-foreground text-[10px] mb-0.5">
            Record ID
          </p>
          <p>{recordId}</p>
          <p className="text-muted-foreground/60 text-[10px] mt-1">
            {copied ? "✓ Copied!" : "Click icon to copy"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AuditLogRow({
  timestamp,
  user,
  action,
  tableName,
  recordId,
  oldData,
  newData,
  isExpanded,
  onToggleExpand,
}: AuditLogRowProps) {
  const changedFields = computeChangedFields(oldData, newData);
  const MAX_VISIBLE_PILLS = 3;
  const visibleFields = changedFields.slice(0, MAX_VISIBLE_PILLS);
  const hiddenFields = changedFields.slice(MAX_VISIBLE_PILLS);

  return (
    <>
      <div
        onClick={onToggleExpand}
        className={cn(
          "group grid cursor-pointer grid-cols-[180px_220px_100px_160px_240px_1fr] gap-4 border-b border-border px-4 py-3 items-center transition-colors",
          isExpanded
            ? "border-l-2 border-l-primary bg-muted/10"
            : "border-l-2 border-l-transparent hover:bg-muted/20"
        )}
      >
        {/* Timestamp */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="text-sm text-foreground font-mono">
            {timestamp.toLocaleString("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {getRelativeTime(timestamp)}
          </div>
        </div>

        {/* User */}
        <div className="text-xs text-foreground truncate font-mono min-w-0">
          {user ?? "System"}
        </div>

        {/* Action */}
        <ActionBadge action={action} />

        {/* Table Name */}
        <div className="text-xs text-primary font-mono truncate min-w-0">
          {tableName}
        </div>

        {/* Record ID */}
        <RecordIdCell recordId={recordId} />

        {/* Changes & Chevron */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-wrap gap-1 min-w-0 flex-1">
            {visibleFields.map((field) => (
              <span
                key={field}
                className="text-[10.5px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-mono whitespace-nowrap"
              >
                {field}
              </span>
            ))}
            {hiddenFields.length > 0 && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono cursor-default hover:border-muted-foreground/50 transition-colors">
                      +{hiddenFields.length} more
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">
                      All changed fields:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {changedFields.map((field) => (
                        <span
                          key={field}
                          className="font-mono text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground flex-shrink-0 ml-auto transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Expanded Diff Panel */}
      {isExpanded && (
        <DiffPanel oldData={oldData} newData={newData} action={action} />
      )}
    </>
  );
}


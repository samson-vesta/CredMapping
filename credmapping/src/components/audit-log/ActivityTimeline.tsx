"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { DiffPanel } from "~/components/audit-log/DiffPanel";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

type AuditAction = "insert" | "update" | "delete";

function toAuditAction(action: string): AuditAction {
  if (action === "create" || action === "insert") return "insert";
  if (action === "delete") return "delete";
  return "update";
}

function actionIcon(action: AuditAction) {
  if (action === "insert") return <Plus className="size-3" />;
  if (action === "delete") return <Trash2 className="size-3" />;
  return <Pencil className="size-3" />;
}

function actionColor(action: AuditAction) {
  if (action === "insert") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  if (action === "delete") return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
  return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
}

function lineColor(action: AuditAction) {
  if (action === "insert") return "bg-emerald-500";
  if (action === "delete") return "bg-red-500";
  return "bg-amber-500";
}

/** Human-readable table names */
const TABLE_LABELS: Record<string, string> = {
  providers: "Provider",
  facilities: "Facility",
  provider_state_licenses: "State License",
  provider_vesta_privileges: "Vesta Privilege",
  provider_facility_credentials: "PFC Credential",
  workflow_phases: "Workflow Phase",
  facility_contacts: "Contact",
  facility_prelive_info: "Pre-live Info",
  incident_logs: "Incident",
};

function humanizeTableName(table: string) {
  return TABLE_LABELS[table] ?? table.replace(/_/g, " ");
}

function getRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function buildDescription(
  action: string,
  tableName: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): string {
  const entity = humanizeTableName(tableName);
  const normalizedAction = toAuditAction(action);

  if (normalizedAction === "insert") {
    // Try to extract a meaningful identifier from newData
    const name =
      (newData?.phase_name as string) ??
      (newData?.state as string) ??
      (newData?.name as string) ??
      (newData?.privilege_tier as string) ??
      (newData?.subcategory as string) ??
      "";
    return name ? `Created ${entity} "${name}"` : `Created ${entity}`;
  }

  if (normalizedAction === "delete") {
    const name =
      (oldData?.phase_name as string) ??
      (oldData?.state as string) ??
      (oldData?.name as string) ??
      (oldData?.privilege_tier as string) ??
      "";
    return name ? `Deleted ${entity} "${name}"` : `Deleted ${entity}`;
  }

  // Update — find the key fields that changed
  if (!oldData || !newData) return `Updated ${entity}`;
  const changed: string[] = [];
  for (const key of Object.keys(newData)) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key.replace(/_/g, " "));
    }
  }
  if (changed.length === 0) return `Updated ${entity}`;

  // Special case: status change is the most important
  const oldStatus = oldData.status as string | undefined;
  const newStatus = newData.status as string | undefined;
  if (oldStatus !== undefined && newStatus !== undefined && oldStatus !== newStatus) {
    return `${entity} status: ${oldStatus} → ${newStatus}`;
  }

  if (changed.length <= 3) {
    return `Updated ${entity}: ${changed.join(", ")}`;
  }
  return `Updated ${entity}: ${changed.length} fields changed`;
}

interface ActivityTimelineProps {
  entityType: "provider" | "facility";
  entityId: string;
}

export function ActivityTimeline({ entityType, entityId }: ActivityTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const { data: entries = [], isLoading } = api.auditLog.listByEntity.useQuery(
    { entityType, entityId, limit: showAll ? 100 : 15 },
    { refetchOnWindowFocus: false },
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => {
        const action = toAuditAction(String(entry.action));
        const isExpanded = expandedIds.has(String(entry.id));
        const isLast = idx === entries.length - 1;
        const oldData = (entry.oldData as Record<string, unknown>) ?? null;
        const newData = (entry.newData as Record<string, unknown>) ?? null;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  actionColor(action),
                )}
              >
                {actionIcon(action)}
              </div>
              {!isLast && (
                <div className={cn("w-0.5 flex-1 min-h-[24px]", lineColor(action), "opacity-20")} />
              )}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-4", !isLast && "border-b border-transparent")}>
              <button
                type="button"
                onClick={() => toggleExpand(String(entry.id))}
                className="flex w-full items-start gap-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {buildDescription(String(entry.action), String(entry.tableName), oldData, newData)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {String(entry.actorEmail ?? "System")} · {getRelativeTime(new Date(String(entry.createdAt)))}
                  </p>
                </div>
                {(oldData || newData) && (
                  <span className="text-muted-foreground mt-0.5 shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </span>
                )}
              </button>
              {isExpanded && (oldData || newData) && (
                <div className="mt-2 overflow-hidden rounded-md border">
                  <DiffPanel
                    action={action}
                    oldData={oldData}
                    newData={newData}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {entries.length >= (showAll ? 100 : 15) && !showAll && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-muted-foreground"
          >
            Load more activity…
          </Button>
        </div>
      )}
    </div>
  );
}

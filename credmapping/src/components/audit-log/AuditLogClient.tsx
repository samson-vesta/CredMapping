"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuditLogRow } from "~/components/audit-log/AuditLogRow";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { DatePicker } from "~/components/ui/date-picker";
import { Input } from "~/components/ui/input";
import { ScrollIndicatorContainer } from "~/components/ui/scroll-indicator-container";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { type auditLog } from "~/server/db/schema";
import { api } from "~/trpc/react";

type AuditLogRecord = typeof auditLog.$inferSelect;

type SortDirection = "asc" | "desc";
type SortField = "timestamp" | "user" | "action" | "tableName" | "recordId" | "changes";

interface FormattedAuditLog {
  id: string;
  timestamp: Date;
  user: string | null;
  action: "insert" | "update" | "delete";
  tableName: string;
  recordId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

const ACTION_VALUES = ["insert", "update", "delete"] as const;

function toAuditAction(action: string | null | undefined): "insert" | "update" | "delete" {
  return ACTION_VALUES.includes(action as (typeof ACTION_VALUES)[number])
    ? (action as "insert" | "update" | "delete")
    : "update";
}

function formatAuditLogRecord(record: AuditLogRecord): FormattedAuditLog {
  return {
    id: record.id,
    timestamp: record.createdAt,
    user: record.actorEmail,
    action: toAuditAction(record.action),
    tableName: record.tableName,
    recordId: record.recordId ? String(record.recordId) : null,
    oldData: (record.oldData as Record<string, unknown>) || null,
    newData: (record.newData as Record<string, unknown>) || null,
  };
}

function computeChangedFieldCount(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): number {
  if (!oldData && !newData) {
    return 0;
  }

  const oldValues = oldData ?? {};
  const newValues = newData ?? {};
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  let count = 0;

  allKeys.forEach((key) => {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      count += 1;
    }
  });

  return count;
}

function SortHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortField === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      {isActive ? sortDirection === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
    </button>
  );
}

export function AuditLogClient() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const PAGE_SIZE = 50;

  const [searchQuery, setSearchQuery] = useState("");
  const [action, setAction] = useState<"all" | "insert" | "update" | "delete">("all");
  const [tableName, setTableName] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(sevenDaysAgo);
  const [toDate, setToDate] = useState(today);

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = api.auditLog.list.useQuery(
    {
      fromDate: fromDate ?? undefined,
      toDate: toDate ?? undefined,
      action: action !== "all" ? action : undefined,
      tableName: tableName ?? undefined,
      actorEmail: searchQuery ?? undefined,
      dataContent: searchQuery ?? undefined,
      limit: PAGE_SIZE,
      offset: 0,
    },
    {
      enabled: false,
    },
  );

  const auditLogs = useMemo(() => result?.rows ?? [], [result?.rows]);

  useEffect(() => {
    setExpandedRows(new Set());
    void refetch();
  }, [action, fromDate, refetch, searchQuery, tableName, toDate]);

  const handleToggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    setSearchQuery("");
    setAction("all");
    setTableName("");
    setFromDate(sevenDaysAgo);
    setToDate(today);
    setExpandedRows(new Set());
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const sortedAuditLogs = useMemo(() => {
    const formatted = auditLogs.map(formatAuditLogRecord);

    return [...formatted].sort((a, b) => {
      const directionMultiplier = sortDirection === "asc" ? 1 : -1;

      const compare = (valueA: string | number, valueB: string | number) => {
        if (valueA < valueB) return -1 * directionMultiplier;
        if (valueA > valueB) return 1 * directionMultiplier;
        return 0;
      };

      switch (sortField) {
        case "timestamp":
          return compare(a.timestamp.getTime(), b.timestamp.getTime());
        case "user":
          return compare((a.user ?? "").toLowerCase(), (b.user ?? "").toLowerCase());
        case "action":
          return compare(a.action, b.action);
        case "tableName":
          return compare(a.tableName.toLowerCase(), b.tableName.toLowerCase());
        case "recordId":
          return compare((a.recordId ?? "").toLowerCase(), (b.recordId ?? "").toLowerCase());
        case "changes":
          return compare(computeChangedFieldCount(a.oldData, a.newData), computeChangedFieldCount(b.oldData, b.newData));
        default:
          return 0;
      }
    });
  }, [auditLogs, sortDirection, sortField]);

  if (error) {
    return (
      <Card className="flex h-full min-h-0 items-center justify-center p-6 text-center">
        <div>
          <p className="text-destructive">Error loading audit logs</p>
          <Button onClick={() => void refetch()} variant="outline" size="sm" className="mt-3">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search user, data content, or record ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={action} onValueChange={(value) => setAction(value as "all" | "insert" | "update" | "delete")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="insert">Insert</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tableName || "all"} onValueChange={(value) => setTableName(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="All Tables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              <SelectItem value="facilities">facilities</SelectItem>
              <SelectItem value="providers">providers</SelectItem>
              <SelectItem value="comm_logs">comm_logs</SelectItem>
              <SelectItem value="certifications">certifications</SelectItem>
              <SelectItem value="doctor_facility_assignments">doctor_facility_assignments</SelectItem>
              <SelectItem value="agents">agents</SelectItem>
            </SelectContent>
          </Select>

          <DatePicker value={fromDate} onChange={setFromDate} placeholder="From date" className="w-[170px]" clearable={false} />
          <DatePicker value={toDate} onChange={setToDate} placeholder="To date" className="w-[170px]" clearable={false} />

          <Button
            onClick={handleClearAll}
            disabled={isLoading}
            className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
          >
            Reset Filters
          </Button>
        </div>

        <div className="border-t border-border" />

        {isLoading ? (
          <div className="space-y-0">
            <div className="grid grid-cols-[180px_220px_110px_160px_240px_1fr] gap-4 border-b border-border bg-muted px-4 py-2">
              {["Timestamp", "User", "Action", "Table", "Record ID", "Changes"].map((column) => (
                <div key={column} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {column}
                </div>
              ))}
            </div>
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[180px_220px_110px_160px_240px_1fr] gap-4 border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : sortedAuditLogs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <span className="text-3xl opacity-30">🔍</span>
            <p className="text-sm">No audit log entries found for the selected filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[180px_220px_110px_160px_240px_1fr] gap-4 border-b border-border bg-muted px-4 py-2">
              <SortHeader label="Timestamp" field="timestamp" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="User" field="user" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Action" field="action" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Table" field="tableName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Record ID" field="recordId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Changes" field="changes" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            </div>

            <ScrollIndicatorContainer className="min-h-0 flex-1" viewportClassName="hide-scrollbar">
              <div className="divide-y divide-border">
                {sortedAuditLogs.map((formatted) => (
                  <AuditLogRow
                    key={formatted.id}
                    timestamp={formatted.timestamp}
                    user={formatted.user}
                    action={formatted.action}
                    tableName={formatted.tableName}
                    recordId={formatted.recordId}
                    oldData={formatted.oldData}
                    newData={formatted.newData}
                    isExpanded={expandedRows.has(formatted.id)}
                    onToggleExpand={() => handleToggleExpand(formatted.id)}
                  />
                ))}
              </div>
            </ScrollIndicatorContainer>
          </>
        )}
      </Card>
    </div>
  );
}

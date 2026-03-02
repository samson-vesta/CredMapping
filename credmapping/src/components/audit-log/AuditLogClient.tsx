"use client";

import { useEffect, useState } from "react";
import { FilterSection } from "~/components/audit-log/FilterSection";
import { AuditLogRow } from "~/components/audit-log/AuditLogRow";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { type auditLog } from "~/server/db/schema";

type AuditLogRecord = typeof auditLog.$inferSelect;

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

function toAuditAction(
  action: string | null | undefined
): "insert" | "update" | "delete" {
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

export function AuditLogClient() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  
  const [user, setUser] = useState("");
  const [action, setAction] = useState<"all" | "insert" | "update" | "delete">(
    "all"
  );
  const [tableName, setTableName] = useState("");
  const [recordId, setRecordId] = useState("");
  const [dataContent, setDataContent] = useState("");

  // Date defaults: 7 days ago to today
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7))
    .toISOString()
    .split("T")[0];

  const [fromDate, setFromDate] = useState(sevenDaysAgo);
  const [toDate, setToDate] = useState(today);

  // Fetch audit logs
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
      actorEmail: user ?? undefined,
      recordId: recordId ?? undefined,
      dataContent: dataContent ?? undefined,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    },
    {
      enabled: false, 
    }
  );

  const auditLogs = result?.rows ?? [];
  const totalCount = result?.total ?? 0;

  // Auto-load on mount
  useEffect(() => {
    void refetch();
  }, [refetch]);

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
    setCurrentPage(1);
    setUser("");
    setAction("all");
    setTableName("");
    setRecordId("");
    setDataContent("");
    setFromDate(sevenDaysAgo);
    setToDate(today);
  };

  const handleLoad = () => {
    void refetch();
  };

  // Calculate stats based on all data (not just current page)
  const insertCount = auditLogs.filter(
    (log) => log.action === "insert"
  ).length;
  const updateCount = auditLogs.filter(
    (log) => log.action === "update"
  ).length;
  const deleteCount = auditLogs.filter(
    (log) => log.action === "delete"
  ).length;
  const uniqueUsers = new Set(
    auditLogs
      .map((log) => log.actorEmail ?? "unknown")
      .filter((email) => email !== "unknown")
  ).size;

  if (error) {
    return (
      <div className="space-y-6">
        {/* Stats Bar - New Top Position */}
        <div className="flex justify-between items-end px-4 py-3 rounded border border-border bg-card">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-semibold text-foreground">{totalCount}</span>
            <span className="text-xs text-muted-foreground uppercase">Total entries</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-semibold text-yellow-400">{updateCount}</span>
            <span className="text-xs text-muted-foreground uppercase">Updates</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-semibold text-green-400">{insertCount}</span>
            <span className="text-xs text-muted-foreground uppercase">Inserts</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-semibold text-destructive">{deleteCount}</span>
            <span className="text-xs text-muted-foreground uppercase">Deletes</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-semibold text-foreground">{uniqueUsers}</span>
            <span className="text-xs text-muted-foreground uppercase">Unique users</span>
          </div>
        </div>

        <FilterSection
          user={user}
          action={action}
          tableName={tableName}
          recordId={recordId}
          dataContent={dataContent}
          fromDate={fromDate}
          toDate={toDate}
          onUserChange={setUser}
          onActionChange={setAction}
          onTableNameChange={setTableName}
          onRecordIdChange={setRecordId}
          onDataContentChange={setDataContent}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onClearAll={handleClearAll}
          onLoad={handleLoad}
          isLoading={isLoading}
        />
        <Card className="p-6 text-center">
          <p className="text-destructive">Error loading audit logs</p>
          <button
            onClick={handleLoad}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Bar - New Top Position */}
      <div className="flex justify-between items-end px-4 py-3 rounded border border-border bg-card">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-semibold text-foreground">{totalCount}</span>
          <span className="text-xs text-muted-foreground uppercase">Total entries</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-semibold text-yellow-400">{updateCount}</span>
          <span className="text-xs text-muted-foreground uppercase">Updates</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-semibold text-green-400">{insertCount}</span>
          <span className="text-xs text-muted-foreground uppercase">Inserts</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-semibold text-destructive">{deleteCount}</span>
          <span className="text-xs text-muted-foreground uppercase">Deletes</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-semibold text-foreground">{uniqueUsers}</span>
          <span className="text-xs text-muted-foreground uppercase">Unique users</span>
        </div>
      </div>

      {/* Filter Section */}
      <FilterSection
        user={user}
        action={action}
        tableName={tableName}
        recordId={recordId}
        dataContent={dataContent}
        fromDate={fromDate}
        toDate={toDate}
        onUserChange={setUser}
        onActionChange={setAction}
        onTableNameChange={setTableName}
        onRecordIdChange={setRecordId}
        onDataContentChange={setDataContent}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onClearAll={handleClearAll}
        onLoad={handleLoad}
        isLoading={isLoading}
      />

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-6 px-4 py-2 rounded border border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Total entries:</span>
          <span className="text-sm font-semibold text-foreground">
            {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 dark:bg-yellow-400" />
          <span className="text-xs text-muted-foreground">Updates:</span>
          <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
            {updateCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400" />
          <span className="text-xs text-muted-foreground">Inserts:</span>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            {insertCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-xs text-muted-foreground">Deletes:</span>
          <span className="text-sm font-semibold text-destructive">
            {deleteCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Unique users:</span>
          <span className="text-sm font-semibold text-foreground">
            {uniqueUsers}
          </span>
        </div>
      </div>

      {/* Entries Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-0">
            <div className="sticky top-0 z-10 grid grid-cols-[180px_220px_100px_160px_240px_1fr] gap-4 border-b border-border bg-muted px-4 py-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Timestamp
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                User
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Action
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Table
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Record ID
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Changes
              </div>
            </div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[180px_220px_100px_160px_240px_1fr] gap-4 border-b border-border px-4 py-3"
              >
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <span className="text-3xl opacity-30">🔍</span>
            <p className="text-sm">
              No audit log entries found for the selected filters
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="sticky top-0 z-10 grid grid-cols-[180px_220px_100px_160px_240px_1fr] gap-4 border-b border-border bg-muted px-4 py-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Timestamp
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                User
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Action
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Table
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Record ID
              </div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Changes
              </div>
            </div>
            {auditLogs.map((log) => {
              const formatted = formatAuditLogRecord(log);
              return (
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
              );
            })}
          </div>
        )}
        
        {/* Pagination Controls */}
        {!isLoading && auditLogs.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/50">
            <div className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="px-3 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(Math.ceil(totalCount / PAGE_SIZE), p + 1)
                  )
                }
                disabled={currentPage >= Math.ceil(totalCount / PAGE_SIZE) || isLoading}
                className="px-3 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

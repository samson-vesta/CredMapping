"use client";

import { CommLogCard } from "./CommLogCard";
import { StandardEmptyState } from "./StandardEmptyState";

interface CommLog {
  id: string;
  commType: string | null;
  subject: string | null;
  notes: string | null;
  createdAt: Date | string | null;
  createdByName: string | null;
  lastUpdatedByName: string | null;
}

interface CommLogFeedProps {
  logs: CommLog[];
  isLoading?: boolean;
  onSelectLog?: (log: CommLog) => void;
}

export function CommLogFeed({
  logs,
  isLoading = false,
  onSelectLog,
}: CommLogFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return <StandardEmptyState message="No activity logs recorded yet" />;
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <CommLogCard
          key={log.id}
          id={log.id}
          commType={log.commType}
          subject={log.subject}
          notes={log.notes}
          createdAt={log.createdAt}
          createdByName={log.createdByName}
          lastUpdatedByName={log.lastUpdatedByName}
          onClick={() => onSelectLog?.(log)}
        />
      ))}
    </div>
  );
}

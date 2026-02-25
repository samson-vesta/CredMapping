"use client";

import { CommLogCard } from "./CommLogCard";

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
  onNewLog?: () => void;
  onSelectLog?: (log: CommLog) => void;
}

export function CommLogFeed({
  logs,
  isLoading = false,
  onNewLog,
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
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
        <p className="text-muted-foreground mb-4 font-medium italic">No activity logs recorded yet</p>
        {onNewLog && (
          <button
            onClick={onNewLog}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-all shadow-sm"
          >
            + Log Interaction
          </button>
        )}
      </div>
    );
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

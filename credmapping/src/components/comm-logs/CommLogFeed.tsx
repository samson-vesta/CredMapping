"use client";

import { CommLogCard } from "./CommLogCard";

interface CommLog {
  id: string;
  commType: string | null;
  subject: string | null;
  notes: string | null;
  status: string | null;
  createdAt: Date | string | null;
  nextFollowupAt: Date | string | null;
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
          <div key={i} className="h-32 bg-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400 mb-4">No communication logs yet</p>
        {onNewLog && (
          <button
            onClick={onNewLog}
            className="inline-block px-4 py-2 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition-colors"
          >
            + Create First Log
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <CommLogCard
          key={log.id}
          id={log.id}
          commType={log.commType}
          subject={log.subject}
          notes={log.notes}
          status={log.status}
          createdAt={log.createdAt}
          nextFollowupAt={log.nextFollowupAt}
          createdByName={log.createdByName}
          lastUpdatedByName={log.lastUpdatedByName}
          onClick={() => onSelectLog?.(log)}
        />
      ))}
    </div>
  );
}

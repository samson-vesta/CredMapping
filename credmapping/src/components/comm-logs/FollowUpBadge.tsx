import { format, isPast, isToday } from "date-fns";

interface FollowUpBadgeProps {
  nextFollowupAt: Date | string | null;
  status?: string | null;
}

export function FollowUpBadge({ nextFollowupAt, status }: FollowUpBadgeProps) {
  if (!nextFollowupAt && status !== "fu_completed") {
    return null;
  }

  if (status === "fu_completed") {
    return (
      <span className="inline-block rounded-full px-2 py-1 text-xs font-medium bg-green-500/15 text-green-400">
        Completed
      </span>
    );
  }

  const date = typeof nextFollowupAt === "string" ? new Date(nextFollowupAt) : nextFollowupAt;

  if (!date) {
    return null;
  }

  const isOverdue = isPast(date) && !isToday(date);
  const isDueToday = isToday(date);

  if (isOverdue) {
    return (
      <span className="inline-block rounded-full px-2 py-1 text-xs font-medium bg-red-500/15 text-red-400">
        Due {format(date, "MMM d")}
      </span>
    );
  }

  if (isDueToday) {
    return (
      <span className="inline-block rounded-full px-2 py-1 text-xs font-medium bg-yellow-500/15 text-yellow-400">
        Due Today
      </span>
    );
  }

  return (
    <span className="inline-block rounded-full px-2 py-1 text-xs font-medium bg-gray-500/15 text-gray-400">
      {format(date, "MMM d")}
    </span>
  );
}

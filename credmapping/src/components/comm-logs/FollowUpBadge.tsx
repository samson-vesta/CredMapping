import { format, isPast, isToday } from "date-fns";

interface FollowUpBadgeProps {
  nextFollowupAt: Date | string | null;
  status?: string | null;
}

export function FollowUpBadge({ nextFollowupAt, status }: FollowUpBadgeProps) {
  const isFinished = status?.toLowerCase().includes("completed") ?? status?.toLowerCase().includes("active");

  if (!nextFollowupAt && !isFinished) {
    return null;
  }

  if (isFinished) {
    return (
      <span className="inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-tighter bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        Ready
      </span>
    );
  }

  const date = nextFollowupAt ? new Date(nextFollowupAt) : null;

  if (!date || isNaN(date.getTime())) {
    return null;
  }

  const isOverdue = isPast(date) && !isToday(date);
  const isDueToday = isToday(date);

  if (isOverdue) {
    return (
      <span className="inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-tighter bg-rose-500/15 text-rose-400 border border-rose-500/20 shadow-sm">
        Past Due: {format(date, "MMM d")}
      </span>
    );
  }

  if (isDueToday) {
    return (
      <span className="inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-tighter bg-amber-500/15 text-amber-400 border border-amber-500/20 shadow-sm">
        Due Today
      </span>
    );
  }

  return (
    <span className="inline-block rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-tighter bg-zinc-500/15 text-zinc-400 border border-zinc-500/10">
      F/U: {format(date, "MMM d")}
    </span>
  );
}
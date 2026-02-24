"use client";

import { cn } from "~/lib/utils";

interface ActionBadgeProps {
  action: "insert" | "update" | "delete" | string;
  className?: string;
}

export function ActionBadge({ action, className }: ActionBadgeProps) {
  const badgeConfig = {
    insert: {
      bg: "bg-green-500/15",
      text: "text-green-400",
      border: "border-green-500/20",
    },
    update: {
      bg: "bg-yellow-500/15",
      text: "text-yellow-400",
      border: "border-yellow-500/20",
    },
    delete: {
      bg: "bg-destructive/15",
      text: "text-destructive",
      border: "border-destructive/20",
    },
  };

  const config =
    badgeConfig[action as keyof typeof badgeConfig] ?? badgeConfig.update;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-1 font-mono text-xs uppercase",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {action}
    </span>
  );
}

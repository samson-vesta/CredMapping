"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

interface CollapsibleSectionProps {
  title: React.ReactNode;
  /** Badge/count shown next to the title when collapsed */
  badge?: React.ReactNode;
  /** Extra element rendered to the right of the header (e.g. an Add button) */
  headerAction?: React.ReactNode;
  defaultOpen?: boolean;
  /** When set, the content area scrolls after this height (e.g. "24rem", "400px") */
  maxHeight?: string;
  className?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  badge,
  headerAction,
  defaultOpen = true,
  maxHeight,
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">
            {title}
          </span>
          {badge !== undefined && badge !== null && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerAction}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div
          className="border-t border-border px-4 pb-4 pt-3 overflow-y-auto"
          style={maxHeight ? { maxHeight } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}

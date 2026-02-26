"use client";

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type StatusDotTone = "red" | "blue" | "amber" | "green";

interface ListItem {
  id: string;
  name: string;
  subText?: string;
  rightMeta?: string;
  statusDots?: StatusDotTone[];
}

interface LeftPanelProps {
  mode: "provider" | "facility";
  onModeChange: (mode: "provider" | "facility") => void;
  items: ListItem[];
  selectedItemId?: string;
  onSelectItem: (id: string) => void;
  isLoading?: boolean;
  filter?: string;
  onFilterChange?: (filter: string) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
}

const providerFilters = ["All", "PSV", "Missing", "Completed"];
const facilityFilters = ["All", "Missing", "General"];

export function LeftPanel({
  mode,
  onModeChange,
  items,
  selectedItemId,
  onSelectItem,
  isLoading = false,
  filter = "All",
  onFilterChange,
  search = "",
  onSearchChange,
}: LeftPanelProps) {
  const filters = mode === "provider" ? providerFilters : facilityFilters;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.subText?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [items, search]);

  const getDotColor = (dot: StatusDotTone) => {
    if (dot === "red") return "bg-rose-500";
    if (dot === "blue") return "bg-blue-500";
    if (dot === "amber") return "bg-amber-400";
    return "bg-emerald-500";
  };

  const getDotLabel = (dot: StatusDotTone) => {
    if (dot === "red") return "Past due follow-up";
    if (dot === "blue") return "Pending PSV";
    if (dot === "amber") return "Missing docs";
    return "No active issues";
  };

  return (
    <div className="flex h-full min-h-0 w-[290px] flex-col border-r border-l border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => onModeChange("provider")}
            className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
              mode === "provider"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            Providers
          </button>
          <button
            onClick={() => onModeChange("facility")}
            className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
              mode === "facility"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            Facilities
          </button>
        </div>

        <input
          type="text"
          placeholder={
            mode === "facility" ? "Search facilities..." : "Search providers..."
          }
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-full rounded border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="border-b border-border px-4 py-3">
        <div
          className="grid w-full overflow-hidden rounded-md border border-border bg-secondary/40"
          style={{ gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))` }}
        >
          {filters.map((f, index) => (
            <button
              key={f}
              onClick={() => onFilterChange?.(f)}
              className={`px-3 py-2 text-center text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-secondary-foreground hover:bg-accent"
              } ${index > 0 ? "border-l border-border" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-zinc-800" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-sm text-zinc-400">
            No {mode === "facility" ? "facilities" : "providers"} found
          </div>
        ) : (
          <div className="p-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                className={`mb-2 w-full rounded-lg border p-2.5 text-left transition-colors ${
                  selectedItemId === item.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border hover:bg-accent/60"
                }`}
              >
                <div className="flex min-h-11 items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-medium text-white">{item.name}</h4>
                    {item.subText && (
                      <p className="truncate text-xs text-zinc-400">{item.subText}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                    <TooltipProvider>
                      {item.statusDots?.map((dot, index) => (
                        <Tooltip key={`${item.id}-${dot}-${index}`}>
                          <TooltipTrigger asChild>
                            <span className={`h-2.5 w-2.5 rounded-full ${getDotColor(dot)}`} />
                          </TooltipTrigger>
                          <TooltipContent>{getDotLabel(dot)}</TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

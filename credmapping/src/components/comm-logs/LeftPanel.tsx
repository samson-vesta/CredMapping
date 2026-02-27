"use client";

import { useMemo } from "react";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { TruncatedTooltip } from "~/components/ui/truncated-tooltip";
import { Input } from "~/components/ui/input";
import { ScrollIndicatorContainer } from "~/components/ui/scroll-indicator-container";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";

type StatusDotTone = "red" | "blue" | "amber" | "green";
type SortOption = "alpha-asc" | "alpha-desc" | "updated-asc" | "updated-desc";

interface ListItem {
  id: string;
  name: string;
  subText?: string;
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
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

const providerFilters = ["All", "PSV", "Missing"];
const facilityFilters = ["All", "Missing"];

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
  sort = "alpha-asc",
  onSortChange,
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

        <Input
          placeholder={
            mode === "facility" ? "Search facilities..." : "Search providers..."
          }
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="h-9 w-full"
        />

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="mt-3 h-9 w-full">
              <SlidersHorizontal className="size-4" /> Filters and Sort
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="gap-0">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Filters and Sort
              </SheetTitle>
            </SheetHeader>
            <div className="border-border space-y-4 border-t px-4 py-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Filter</label>
                <select
                  value={filter}
                  onChange={(event) => onFilterChange?.(event.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                >
                  {filters.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Sort Order</label>
                <select
                  value={sort}
                  onChange={(event) => onSortChange?.(event.target.value as SortOption)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                >
                  <option value="alpha-asc">Alphabetical (A → Z)</option>
                  <option value="alpha-desc">Alphabetical (Z → A)</option>
                  <option value="updated-asc">Last Updated (Oldest First)</option>
                  <option value="updated-desc">Last Updated (Newest First)</option>
                </select>
              </div>
            </div>
            <SheetFooter className="px-4 py-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  onFilterChange?.("All");
                  onSortChange?.("alpha-asc");
                }}
              >
                Reset filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <ScrollIndicatorContainer className="flex-1">
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
          <div className="space-y-2 px-4 py-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                  selectedItemId === item.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border hover:bg-accent/60"
                }`}
              >
                <div className="flex min-h-11 items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <TruncatedTooltip
                      text={item.name}
                      as="h4"
                      className="font-medium text-white"
                    />
                    {item.subText && (
                      <p className="truncate text-xs text-zinc-400">{item.subText}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                    {item.statusDots?.map((dot, index) => (
                      <Tooltip key={`${item.id}-${dot}-${index}`}>
                        <TooltipTrigger asChild>
                          <span className={`h-2.5 w-2.5 rounded-full ${getDotColor(dot)}`} />
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" sideOffset={6}>
                          {getDotLabel(dot)}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollIndicatorContainer>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { FollowUpBadge } from "./FollowUpBadge";

interface ListItem {
  id: string;
  name: string;
  subText?: string;
  rightMeta?: string;
  badge?: string;
  nextFollowupAt: Date | string | null;
  status?: string | null;
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

const providerFilters = ["All", "Past Due", "Due Today", "Pending", "Completed"];
const facilityFilters = ["All", "CRED", "NON-CRED", "Past Due", "Pending"];

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

  return (
    <div className="flex h-full min-h-0 w-[290px] flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-4">
        {/* Toggle buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onModeChange("provider")}
            className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-colors ${
              mode === "provider"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            Providers
          </button>
          <button
            onClick={() => onModeChange("facility")}
            className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-colors ${
              mode === "facility"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            Facilities
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={mode === "facility" ? "Search facilities..." : "Search providers..."}
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-full rounded border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange?.(f)}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-zinc-800 rounded animate-pulse"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-zinc-400 text-sm">
            No {mode === "facility" ? "facilities" : "providers"} found
          </div>
        ) : (
          <div className="p-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                  selectedItemId === item.id
                    ? "border border-primary/40 bg-primary/10"
                    : "border border-border hover:bg-accent/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h4 className="min-w-0 flex-1 truncate font-medium text-white">
                        {item.name}
                      </h4>
                      <span className="max-w-[40%] truncate text-xs font-medium text-zinc-400">
                        {item.rightMeta}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {item.subText ? (
                        <p className="text-xs text-zinc-400 truncate">
                          {item.subText}
                        </p>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      {item.status && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${
                            item.status === "Active"
                              ? "bg-green-500/15 text-green-400"
                              : item.status === "Inactive"
                                ? "bg-zinc-700 text-zinc-400"
                                : item.status === "Pending"
                                  ? "bg-yellow-500/15 text-yellow-400"
                                  : ""
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 empty:hidden">
                    <FollowUpBadge
                      nextFollowupAt={item.nextFollowupAt}
                      status={item.status}
                    />
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

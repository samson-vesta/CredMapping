"use client";

import { useState } from "react";
import { type ChartMode, CHART_MODES, MetricsTrendChart, type ViewMode, VIEW_MODES } from "~/components/metrics-trend-chart";
import { Button } from "~/components/ui/button";
import { FacilitiesFilterBar } from "./facilities-filter-bar";

interface TrendPoint {
  date: string;
  primary: number;
  secondary: number;
  tertiary: number;
}

interface FacilitiesTopSectionProps {
  trendPoints: TrendPoint[];
  sort: string;
  activityFilter: string;
  search: string;
  isSuperAdmin: boolean;
}

export function FacilitiesTopSection({
  trendPoints,
  sort,
  activityFilter,
  search,
  isSuperAdmin,
}: FacilitiesTopSectionProps) {
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [chartMode, setChartMode] = useState<ChartMode>("line");

  const graphFilters = isChartOpen ? (
    <div className="space-y-2 border-t pt-3">
      <h3 className="text-base font-semibold">Graph filters</h3>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1 rounded-md border p-1">
          {VIEW_MODES.map((option) => (
            <Button
              className="w-full justify-center"
              key={option}
              onClick={() => setViewMode(option)}
              size="sm"
              type="button"
              variant={viewMode === option ? "default" : "ghost"}
            >
              {option}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-md border p-1">
          {CHART_MODES.map((option) => (
            <Button
              className="w-full justify-center"
              key={option}
              onClick={() => setChartMode(option)}
              size="sm"
              type="button"
              variant={chartMode === option ? "default" : "ghost"}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      className={
        isChartOpen
          ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch"
          : "flex flex-col gap-4 lg:flex-row lg:items-stretch"
      }
    >
      <div className={isChartOpen ? "min-w-0" : "min-w-0 lg:flex-1"}>
        <MetricsTrendChart
          chartMode={chartMode}
          labels={{
            primary: "New facilities",
            secondary: "New PFC links",
            tertiary: "Related incidents",
          }}
          onChartModeChange={setChartMode}
          onOpenChange={setIsChartOpen}
          onViewModeChange={setViewMode}
          points={trendPoints}
          showGraphFilters={!isChartOpen}
          title="Facility onboarding velocity"
          viewMode={viewMode}
        />
      </div>

      <div className={isChartOpen ? "min-h-0" : "lg:w-auto"}>
        <FacilitiesFilterBar
          activityFilter={activityFilter}
          compact={!isChartOpen}
          graphFilters={graphFilters}
          isSuperAdmin={isSuperAdmin}
          search={search}
          sort={sort}
        />
      </div>
    </div>
  );
}

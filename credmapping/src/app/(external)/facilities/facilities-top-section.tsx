"use client";

import { useState } from "react";
import { MetricsTrendChart } from "~/components/metrics-trend-chart";
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
  contactsFilter: string;
  search: string;
  isSuperAdmin: boolean;
}

export function FacilitiesTopSection({
  trendPoints,
  sort,
  activityFilter,
  contactsFilter,
  search,
  isSuperAdmin,
}: FacilitiesTopSectionProps) {
  const [isChartOpen, setIsChartOpen] = useState(false);

  return (
    <div
      className={
        isChartOpen
          ? "grid gap-4 lg:grid-cols-[1fr_280px]"
          : "flex flex-col gap-4 lg:flex-row lg:items-stretch"
      }
    >
      {/* Chart — takes remaining width when open, full row when sidebar collapses */}
      <div className={isChartOpen ? "" : "lg:flex-1"}>
        <MetricsTrendChart
          labels={{
            primary: "New facilities",
            secondary: "New PFC links",
            tertiary: "Related incidents",
          }}
          onOpenChange={setIsChartOpen}
          points={trendPoints}
          title="Facility onboarding velocity"
        />
      </div>

      {/* Filter bar — vertical sidebar when chart open, horizontal row when chart collapsed */}
      <div className={isChartOpen ? "" : "lg:w-auto"}>
        <FacilitiesFilterBar
          activityFilter={activityFilter}
          compact={!isChartOpen}
          contactsFilter={contactsFilter}
          isSuperAdmin={isSuperAdmin}
          search={search}
          sort={sort}
        />
      </div>
    </div>
  );
}

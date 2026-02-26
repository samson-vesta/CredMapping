"use client";

import { useState } from "react";
import { MetricsTrendChart } from "~/components/metrics-trend-chart";
import { ProvidersFilterBar } from "./providers-filter-bar";

interface TrendPoint {
  date: string;
  primary: number;
  secondary: number;
  tertiary: number;
}

interface ProvidersTopSectionProps {
  trendPoints: TrendPoint[];
  sort: string;
  doctorStatusFilter: string;
  search: string;
  statusOptions: string[];
  isSuperAdmin: boolean;
}

export function ProvidersTopSection({
  trendPoints,
  sort,
  doctorStatusFilter,
  search,
  statusOptions,
  isSuperAdmin,
}: ProvidersTopSectionProps) {
  const [isChartOpen, setIsChartOpen] = useState(false);

  return (
    <div
      className={
        isChartOpen
          ? "grid gap-4 lg:grid-cols-[1fr_280px]"
          : "flex flex-col gap-4 lg:flex-row lg:items-stretch"
      }
    >
      <div className={isChartOpen ? "" : "lg:flex-1"}>
        <MetricsTrendChart
          labels={{
            primary: "New providers",
            secondary: "New PFC records",
            tertiary: "Related incidents",
          }}
          onOpenChange={setIsChartOpen}
          points={trendPoints}
          title="Provider onboarding velocity"
        />
      </div>

      <div className={isChartOpen ? "" : "lg:w-auto"}>
        <ProvidersFilterBar
          compact={!isChartOpen}
          doctorStatusFilter={doctorStatusFilter}
          isSuperAdmin={isSuperAdmin}
          search={search}
          sort={sort}
          statusOptions={statusOptions}
        />
      </div>
    </div>
  );
}

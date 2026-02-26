"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { Button } from "~/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";

type TrendPoint = {
  date: string;
  primary: number;
  secondary: number;
  tertiary: number;
};

type ViewMode = "daily" | "monthly" | "yearly";
type ChartMode = "line" | "bar";
type MetricKey = "primary" | "secondary" | "tertiary";

type AggregatedPoint = {
  label: string;
  sortKey: number;
  primary: number;
  secondary: number;
  tertiary: number;
};

const viewModes: ViewMode[] = ["daily", "monthly", "yearly"];
const chartModes: ChartMode[] = ["line", "bar"];

const defaultChartConfig = {
  primary: { label: "Primary", color: "#22c55e" },
  secondary: { label: "Secondary", color: "#3b82f6" },
  tertiary: { label: "Tertiary", color: "#f97316" },
} satisfies ChartConfig;

const toDayKey = (date: Date) => date.toISOString().slice(0, 10);

const subtractDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
};

const monthKeyToTimestamp = (key: string) => {
  const [yearString, monthString] = key.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
  return Date.UTC(year, month - 1, 1);
};

const aggregatePoints = (points: TrendPoint[], mode: ViewMode): AggregatedPoint[] => {
  const validPoints = points
    .map((point) => {
      const date = new Date(point.date);
      if (Number.isNaN(date.getTime())) return null;
      return { point, date };
    })
    .filter((entry): entry is { point: TrendPoint; date: Date } => entry !== null);

  if (validPoints.length === 0) return [];

  if (mode === "yearly") {
    const monthly = new Map<string, AggregatedPoint>();

    for (const entry of validPoints) {
      const key = `${entry.date.getUTCFullYear()}-${String(entry.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const existing = monthly.get(key);
      if (existing) {
        existing.primary += entry.point.primary;
        existing.secondary += entry.point.secondary;
        existing.tertiary += entry.point.tertiary;
        continue;
      }

      monthly.set(key, {
        label: entry.date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
        sortKey: monthKeyToTimestamp(key),
        primary: entry.point.primary,
        secondary: entry.point.secondary,
        tertiary: entry.point.tertiary,
      });
    }

    return Array.from(monthly.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-12);
  }

  // Daily and monthly views both show day-level breakdown,
  // with different time windows for readability.
  const latestDate = validPoints.reduce(
    (latest, entry) => (entry.date.getTime() > latest.getTime() ? entry.date : latest),
    validPoints[0]!.date,
  );

  const rangeStart =
    mode === "daily"
      ? subtractDays(latestDate, 13) // last 14 days
      : subtractDays(latestDate, 29); // last 30 days (daily breakdown)

  const groupedByDay = new Map<string, AggregatedPoint>();

  for (const entry of validPoints) {
    if (entry.date.getTime() < rangeStart.getTime()) continue;
    const key = toDayKey(entry.date);
    const existing = groupedByDay.get(key);
    if (existing) {
      existing.primary += entry.point.primary;
      existing.secondary += entry.point.secondary;
      existing.tertiary += entry.point.tertiary;
      continue;
    }

    groupedByDay.set(key, {
      label: entry.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      sortKey: entry.date.getTime(),
      primary: entry.point.primary,
      secondary: entry.point.secondary,
      tertiary: entry.point.tertiary,
    });
  }

  const result: AggregatedPoint[] = [];
  const dayCount = mode === "daily" ? 14 : 30;

  for (let index = dayCount - 1; index >= 0; index -= 1) {
    const day = subtractDays(latestDate, index);
    const key = toDayKey(day);
    const existing = groupedByDay.get(key);

    result.push(
      existing ?? {
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        sortKey: day.getTime(),
        primary: 0,
        secondary: 0,
        tertiary: 0,
      },
    );
  }

  return result;
};

export function MetricsTrendChart({
  title,
  points,
  labels,
  onOpenChange,
  defaultOpen = false,
}: {
  title: string;
  points: TrendPoint[];
  labels: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  onOpenChange?: (isOpen: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [chartMode, setChartMode] = useState<ChartMode>("line");

  const chartConfig = {
    primary: { ...defaultChartConfig.primary, label: labels.primary },
    secondary: { ...defaultChartConfig.secondary, label: labels.secondary },
    tertiary: { ...defaultChartConfig.tertiary, label: labels.tertiary },
  } satisfies ChartConfig;

  const chartData = useMemo(() => aggregatePoints(points, viewMode), [points, viewMode]);

  const metricCards: { key: MetricKey; label: string }[] = [
    { key: "primary", label: labels.primary },
    { key: "secondary", label: labels.secondary },
    { key: "tertiary", label: labels.tertiary },
  ];

  return (
    <section className="bg-card rounded-lg border p-4">
      <details
        className="group"
        open={defaultOpen || undefined}
        onToggle={(e) => onOpenChange?.((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <h2 className="text-base font-semibold">{title}</h2>
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-3 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 rounded-md border p-1">
              {viewModes.map((option) => (
                <Button
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
            <div className="flex gap-1 rounded-md border p-1">
              {chartModes.map((option) => (
                <Button
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

          {chartData.length === 0 ? (
            <p className="text-muted-foreground py-6 text-sm">No historical trend data available.</p>
          ) : (
            <div className="mt-4">
              {/* Metric totals legend row */}
              <div className="mb-3 flex flex-wrap gap-4">
                {metricCards.map((metric) => {
                  const total = chartData.reduce((sum, d) => sum + d[metric.key], 0);
                  return (
                    <div key={metric.key} className="flex items-center gap-1.5 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: `var(--color-${metric.key})` }}
                      />
                      <span className="text-muted-foreground">{metric.label}:</span>
                      <span className="font-semibold">{total.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Single combined chart */}
              <ChartContainer className="h-[180px] w-full" config={chartConfig}>
                {chartMode === "line" ? (
                  <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} minTickGap={28} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {metricCards.map((metric) => (
                      <Line
                        key={metric.key}
                        dataKey={metric.key}
                        stroke={`var(--color-${metric.key})`}
                        strokeWidth={2}
                        type="monotone"
                        dot={false}
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} minTickGap={28} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {metricCards.map((metric) => (
                      <Bar
                        key={metric.key}
                        dataKey={metric.key}
                        fill={`var(--color-${metric.key})`}
                        radius={3}
                      />
                    ))}
                  </BarChart>
                )}
              </ChartContainer>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

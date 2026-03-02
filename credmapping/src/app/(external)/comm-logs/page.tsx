"use client";

import { useEffect, useMemo, useState } from "react";
import { LeftPanel } from "~/components/comm-logs/LeftPanel";
import { ProviderDetail } from "~/components/comm-logs/ProviderDetail";
import { FacilityDetail } from "~/components/comm-logs/FacilityDetail";
import { api } from "~/trpc/react";
import { useSearchParams } from "next/navigation";

type ProviderWithStatus = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  degree: string | null;
  email: string | null;
  privilegeTier: string | null;
  latestStatus: string | null;
  nextFollowupAt: Date | null;
  lastUpdatedAt: Date | null;
  hasMissingDocs?: boolean;
  hasPSV?: boolean;
};

type FacilityWithStatus = {
  id: string;
  name: string | null;
  state: string | null;
  status: string | null;
  latestStatus: string | null;
  nextFollowupAt: Date | null;
  lastUpdatedAt: Date | null;
  hasMissingDocs: boolean;
};



type SortOption = "alpha-asc" | "alpha-desc" | "updated-asc" | "updated-desc";

const formatLastUpdated = (value: Date | string | null | undefined) => {
  if (!value) return "Last Updated: —";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Last Updated: —";

  return `Last Updated: ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
};

const buildStatusDots = (options: {
  hasMissingDocs?: boolean;
  hasPSV?: boolean;
  nextFollowupAt?: Date | string | null;
  isComplete?: boolean;
}) => {
  const dots: Array<"red" | "blue" | "amber" | "green"> = [];
  const now = Date.now();
  const followupTime = options.nextFollowupAt ? new Date(options.nextFollowupAt).getTime() : null;

  if (followupTime && followupTime < now) dots.push("red");
  if (options.hasPSV) dots.push("blue");
  if (options.hasMissingDocs) dots.push("amber");
  if (!options.hasMissingDocs && !options.hasPSV && options.isComplete) dots.push("green");

  return dots;
};

export default function CommLogsPage() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as "provider" | "facility") ?? "provider";
  const initialId = searchParams.get("id") ?? undefined;

  const [mode, setMode] = useState<"provider" | "facility">(initialMode);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<SortOption>("alpha-asc");

  const normalizedFilter = useMemo(() => {
    if (filter === "PSV") return "psv";
    if (filter === "Missing") return "missing";
    return "all";
  }, [filter]);

  const { data: providers, isLoading: providersLoading } =
    api.providersWithCommLogs.listWithCommLogStatus.useQuery(
      {
        search,
        filter: normalizedFilter,
      },
      { enabled: mode === "provider" },
    );

  const { data: facilities, isLoading: facilitiesLoading } =
    api.facilitiesWithCommLogs.listWithCommLogStatus.useQuery(
      {
        search,
        filter: normalizedFilter,
      },
      { enabled: mode === "facility" },
    );

  const items = useMemo(
    () => (mode === "provider" ? providers : facilities) ?? [],
    [facilities, mode, providers],
  );
  const isLoading = mode === "provider" ? providersLoading : facilitiesLoading;

  const mappedItems = useMemo(() => {
    const rows = items.map((item) => {
      if (mode === "provider") {
        const provider = item as ProviderWithStatus;
        const fullName = [provider.lastName, provider.firstName]
          .filter((value): value is string => Boolean(value?.trim()))
          .join(", ");

        return {
          id: provider.id,
          name: fullName,
          subText: formatLastUpdated(provider.lastUpdatedAt),
          lastUpdatedAt: provider.lastUpdatedAt,
          statusDots: buildStatusDots({
            hasMissingDocs: provider.hasMissingDocs,
            hasPSV: provider.hasPSV,
            nextFollowupAt: provider.nextFollowupAt,
            isComplete: true,
          }),
        };
      }

      const facility = item as FacilityWithStatus;
      return {
        id: facility.id,
        name: facility.name ?? "",
        subText: formatLastUpdated(facility.lastUpdatedAt),
        lastUpdatedAt: facility.lastUpdatedAt,
        statusDots: buildStatusDots({
          hasMissingDocs: facility.hasMissingDocs,
          nextFollowupAt: facility.nextFollowupAt,
          isComplete: !facility.hasMissingDocs,
        }),
      };
    });

    return rows.sort((a, b) => {
      if (sort === "alpha-asc") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sort === "alpha-desc") {
        return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
      }

      const aTime = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
      const bTime = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
      return sort === "updated-asc" ? aTime - bTime : bTime - aTime;
    });
  }, [items, mode, sort]);

  useEffect(() => {
    if (isLoading) return;
    if (mappedItems.length === 0) {
      if (selectedId) setSelectedId(undefined);
      return;
    }

    const selectedStillExists = selectedId
      ? mappedItems.some((item) => item.id === selectedId)
      : false;

    if (!selectedStillExists) {
      setSelectedId(mappedItems[0]?.id);
    }
  }, [isLoading, mappedItems, selectedId]);

  const handleModeChange = (newMode: "provider" | "facility") => {
    setMode(newMode);
    setSelectedId(undefined);
    setFilter("All");
    setSearch("");
    setSort("alpha-asc");
  };

  const selectedProvider =
    selectedId && mode === "provider" ? (providers ?? []).find((p) => p.id === selectedId) : null;

  const selectedFacility =
    selectedId && mode === "facility" ? (facilities ?? []).find((f) => f.id === selectedId) : null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden border-y border-border bg-background">
      <LeftPanel
        mode={mode}
        onModeChange={handleModeChange}
        items={mappedItems}
        selectedItemId={selectedId}
        onSelectItem={setSelectedId}
        isLoading={isLoading}
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden border-r border-border bg-card">
        {!selectedId ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground text-lg italic">
                Select a {mode} from the left to view active roadblocks and history
              </p>
            </div>
          </div>
        ) : selectedProvider ? (
          <ProviderDetail
            providerId={selectedId}
            provider={{
              id: selectedProvider.id,
              firstName: selectedProvider.firstName,
              lastName: selectedProvider.lastName,
              degree: selectedProvider.degree,
              email: selectedProvider.email,
              privilegeTier: selectedProvider.privilegeTier,
            }}
          />
        ) : selectedFacility ? (
          <FacilityDetail
            facilityId={selectedId}
            facility={{
              id: selectedFacility.id,
              name: selectedFacility.name,
              state: selectedFacility.state,
              status: selectedFacility.status,
              address: null,
              email: null,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

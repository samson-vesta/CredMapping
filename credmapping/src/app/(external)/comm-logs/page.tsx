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
  nextFollowupAt: Date | null;
  latestStatus: string | null;
};

type FacilityWithStatus = {
  id: string;
  name: string | null;
  state: string | null;
  status: string | null;
  nextFollowupAt: Date | null;
  latestStatus: string | null;
};

export default function CommLogsPage() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as "provider" | "facility") ?? "provider";
  const initialId = searchParams.get("id") ?? undefined;

  const [mode, setMode] = useState<"provider" | "facility">(initialMode);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // Fetch providers or facilities based on mode
  const { data: providers, isLoading: providersLoading } =
    api.providersWithCommLogs.listWithCommLogStatus.useQuery(
      {
        search,
        filter: filter.toLowerCase().replace(" ", "-") as "all" | "past-due" | "due-today" | "pending" | "completed",
      },
      { enabled: mode === "provider" }
    );

  const { data: facilities, isLoading: facilitiesLoading } =
    api.facilitiesWithCommLogs.listWithCommLogStatus.useQuery(
      {
        search,
        filter: filter.toLowerCase().replace(" ", "-") as "all" | "cred" | "non-cred" | "past-due" | "pending",
      },
      { enabled: mode === "facility" }
    );

  const items = useMemo(
    () => (mode === "provider" ? providers : facilities) ?? [],
    [facilities, mode, providers],
  );
  const isLoading = mode === "provider" ? providersLoading : facilitiesLoading;

  const mappedItems = useMemo(
    () =>
      items.map((item) => {
        if (mode === "provider") {
          const provider = item as ProviderWithStatus;
          return {
            id: provider.id,
            name: `${provider.lastName ?? ""}, ${provider.firstName ?? ""}`,
            subText: provider.email ?? undefined,
            rightMeta: provider.degree ?? undefined,
            nextFollowupAt: provider.nextFollowupAt,
            status: provider.latestStatus,
          };
        }

        const facility = item as FacilityWithStatus;
        return {
          id: facility.id,
          name: facility.name ?? "",
          rightMeta: facility.state ?? undefined,
          nextFollowupAt: facility.nextFollowupAt,
          status: facility.latestStatus,
        };
      }),
    [items, mode],
  );

  useEffect(() => {
    if (isLoading) return;

    if (mappedItems.length === 0) {
      if (selectedId) {
        setSelectedId(undefined);
      }
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
  };

  // Get selected provider or facility data
  const selectedProvider = selectedId && mode === "provider"
    ? (providers ?? []).find((p) => p.id === selectedId)
    : null;

  const selectedFacility = selectedId && mode === "facility"
    ? (facilities ?? []).find((f) => f.id === selectedId)
    : null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      {/* Left Panel */}
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
      />

      {/* Right Panel - Content */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-zinc-400 text-lg">
                Select a {mode} from the left to view details
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
              notes: null,
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

"use client";

import { Search, X, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AddProviderDialog } from "~/components/providers/add-provider-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useSetProvidersPending } from "./providers-pending-context";

interface ProvidersFilterBarProps {
  sort: string;
  doctorStatusFilter: string;
  search: string;
  statusOptions: string[];
  isSuperAdmin: boolean;
  /** When true, renders filters in a single horizontal row (chart is collapsed). */
  compact?: boolean;
}

const DEFAULTS: Record<string, string> = {
  sort: "name_asc",
  doctorStatus: "all",
};

export function ProvidersFilterBar({
  sort,
  doctorStatusFilter,
  search: initialSearch,
  statusOptions,
  isSuperAdmin,
  compact = false,
}: ProvidersFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSetProvidersPending(isPending);

  const navigate = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (!value || value === DEFAULTS[key]) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    params.delete("limit");
    const qs = params.toString();
    startTransition(() => {
      router.push(`/providers${qs ? `?${qs}` : ""}`);
    });
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value || undefined });
    }, 450);
  };

  const handleReset = () => {
    setLocalSearch("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => {
      router.push("/providers");
    });
  };

  const hasActiveFilters =
    sort !== "name_asc" ||
    doctorStatusFilter !== "all" ||
    initialSearch !== "";

  if (compact) {
    return (
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 pr-8 text-sm"
            disabled={isPending}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search…"
            value={localSearch}
          />
          {localSearch && (
            <button
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => handleSearchChange("")}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          disabled={isPending}
          onChange={(e) => navigate({ sort: e.target.value })}
          value={sort}
        >
          <option value="name_asc">Name (A → Z)</option>
          <option value="name_desc">Name (Z → A)</option>
          <option value="expired_privs_desc">Expired (high → low)</option>
          <option value="expired_privs_asc">Expired (low → high)</option>
        </select>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          disabled={isPending}
          onChange={(e) => navigate({ doctorStatus: e.target.value })}
          value={doctorStatusFilter}
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        {hasActiveFilters && (
          <Button disabled={isPending} onClick={handleReset} size="sm" variant="outline">
            <X className="h-3.5 w-3.5" /> Reset
          </Button>
        )}

        {isSuperAdmin && <AddProviderDialog />}
      </div>
    );
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
        </h2>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 pr-8 text-sm"
          disabled={isPending}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name, email, notes…"
          value={localSearch}
        />
        {localSearch && (
          <button
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            onClick={() => handleSearchChange("")}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sort */}
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Sort by</span>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          disabled={isPending}
          onChange={(e) => navigate({ sort: e.target.value })}
          value={sort}
        >
          <option value="name_asc">Doctor name (A → Z)</option>
          <option value="name_desc">Doctor name (Z → A)</option>
          <option value="expired_privs_desc">Expired privileges (high → low)</option>
          <option value="expired_privs_asc">Expired privileges (low → high)</option>
        </select>
      </label>

      {/* Doctor status */}
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Doctor status</span>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          disabled={isPending}
          onChange={(e) => navigate({ doctorStatus: e.target.value })}
          value={doctorStatusFilter}
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {hasActiveFilters && (
          <Button
            className="flex-1"
            disabled={isPending}
            onClick={handleReset}
            size="sm"
            variant="outline"
          >
            <X className="h-3.5 w-3.5" /> Reset filters
          </Button>
        )}
        {isSuperAdmin && <AddProviderDialog />}
      </div>
    </div>
  );
}

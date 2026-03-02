"use client";

import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { TruncatedTooltip } from "~/components/ui/truncated-tooltip";
import { cn } from "~/lib/utils";

type ViewKey = "providerFacility" | "facilityProvider" | "facilityPrelive" | "providerLicense" | "providerVestaPrivileges";
type SortDirection = "asc" | "desc";
type GroupSortField = "name" | "updated";
type BooleanFilter = "all" | "yes" | "no";
type DetailSortField =
  | "facility"
  | "provider"
  | "priority"
  | "privileges"
  | "status"
  | "type"
  | "application"
  | "state"
  | "path"
  | "initialOrRenewal"
  | "requested"
  | "finalDate";

type ProviderFacilityRow = {
  id: string;
  providerId: string | null;
  providerName: string;
  providerDegree: string | null;
  facilityId: string | null;
  facilityName: string;
  facilityState: string | null;
  priority: string | null;
  privileges: string | null;
  decision: string | null;
  facilityType: string | null;
  applicationRequired: boolean | null;
  updatedAt: string | null;
};

type FacilityPreliveRow = {
  id: string;
  facilityId: string | null;
  facilityName: string;
  facilityState: string | null;
  priority: string | null;
  goLiveDate: string | null;
  credentialingDueDate: string | null;
  boardMeetingDate: string | null;
  tempsPossible: boolean | null;
  payorEnrollmentRequired: boolean | null;
  rolesNeeded: string[];
  updatedAt: string | null;
};

type ProviderLicenseRow = {
  id: string;
  providerId: string | null;
  providerName: string;
  providerDegree: string | null;
  state: string | null;
  priority: string | null;
  status: string | null;
  path: string | null;
  initialOrRenewal: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
};

type ProviderVestaPrivilegesRow = {
  id: string;
  providerId: string | null;
  providerName: string | null;
  providerDegree: string | null;
  privilegeTier: "Inactive" | "Full" | "Temp" | "In Progress" | null;
  currentPrivInitDate: string | null;
  currentPrivEndDate: string | null;
  termDate: string | null;
  termReason: string | null;
  pastPrivileges: Array<{
    approved_at: string;
    expires_at: string;
    tier?: string;
  }> | null;
  updatedAt: string | null;
};

type DashboardClientProps = {
  providerFacilityRows: ProviderFacilityRow[];
  facilityPreliveRows: FacilityPreliveRow[];
  providerLicenseRows: ProviderLicenseRow[];
  providerVestaPrivilegesRows: ProviderVestaPrivilegesRow[];
};

type GroupedRows<T> = {
  key: string;
  label: string;
  subtitle?: string;
  rows: T[];
};

const viewButtons: Array<{ key: ViewKey; label: string }> = [
  { key: "providerFacility", label: "Provider-Level Facility Credentials" },
  { key: "facilityProvider", label: "Facility-Level Provider Credentials" },
  { key: "facilityPrelive", label: "Facility Pre-Live Details" },
  { key: "providerLicense", label: "Provider-Level State Licenses" },
  { key: "providerVestaPrivileges", label: "Provider Vesta Privileges" },
];

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const PRIORITY_ORDER = ["superstat", "stat", "top", "high", "medium"] as const;

const priorityRank = (value: string | null | undefined) => {
  const normalized = normalize(value).replace(/[^a-z]/g, "");
  const index = PRIORITY_ORDER.findIndex((priority) => priority === normalized);
  return index === -1 ? PRIORITY_ORDER.length : index;
};

const sortPriorities = (values: string[]) =>
  [...values].sort((a, b) => {
    const rankA = priorityRank(a);
    const rankB = priorityRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });

const matchesBooleanFilter = (value: boolean | null, filter: BooleanFilter) => {
  if (filter === "all") return true;
  if (filter === "yes") return value === true;
  return value === false;
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const statusTone = (value: string | null) => {
  const normalized = normalize(value);
  if (normalized.includes("full") || normalized.includes("approved")) return "border-emerald-600/50 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (normalized.includes("progress") || normalized.includes("awaiting") || normalized.includes("pending")) return "border-blue-600/50 bg-blue-50 text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-200";
  if (normalized.includes("inactive") || normalized.includes("missing") || normalized.includes("hold") || normalized.includes("ineligible")) return "border-violet-600/50 bg-violet-50 text-violet-800 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-200";
  return "border-border bg-muted text-foreground";
};

const priorityTone = (value: string | null) => {
  const normalized = normalize(value);
  if (normalized.includes("top")) return "border-rose-600/50 bg-rose-50 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-200";
  if (normalized.includes("super stat") || normalized.includes("stat")) return "border-blue-600/50 bg-blue-50 text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-200";
  if (normalized.includes("high")) return "border-orange-600/50 bg-orange-50 text-orange-800 dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-200";
  if (normalized.includes("medium")) return "border-amber-700/50 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100";
  if (normalized.includes("low")) return "border-yellow-700/50 bg-yellow-50 text-yellow-900 dark:border-yellow-500/50 dark:bg-yellow-500/15 dark:text-yellow-100";
  return "border-border bg-muted text-foreground";
};

function groupBy<T>(rows: T[], keyFn: (row: T) => string, labelFn: (row: T) => string, subtitleFn?: (row: T) => string | undefined): GroupedRows<T>[] {
  const map = new Map<string, GroupedRows<T>>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    map.set(key, { key, label: labelFn(row), subtitle: subtitleFn?.(row), rows: [row] });
  }
  return Array.from(map.values());
}

function sortByDirection<T>(rows: T[], direction: SortDirection, getter: (row: T) => string | number) {
  return [...rows].sort((a, b) => {
    const aVal = getter(a);
    const bVal = getter(b);
    const base = typeof aVal === "number" && typeof bVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal));
    return direction === "asc" ? base : -base;
  });
}

function rowsMatchSearch(rows: ProviderFacilityRow[] | FacilityPreliveRow[] | ProviderLicenseRow[] | ProviderVestaPrivilegesRow[], query: string) {
  const q = normalize(query);
  if (!q) return rows;
  return rows.filter((row) => {
    if ("providerName" in row && "facilityName" in row) {
      return [row.providerName, row.facilityName, row.facilityState ?? "", row.priority ?? "", row.privileges ?? "", row.decision ?? "", row.facilityType ?? ""].join(" ").toLowerCase().includes(q);
    }
    if ("facilityName" in row && "rolesNeeded" in row) {
      return [row.facilityName, row.facilityState ?? "", row.priority ?? "", row.rolesNeeded.join(" ")].join(" ").toLowerCase().includes(q);
    }
    if ("providerName" in row && "privilegeTier" in row) {
      return [row.providerName, row.privilegeTier ?? "", row.currentPrivInitDate ?? "", row.currentPrivEndDate ?? "", row.termDate ?? "", row.termReason ?? ""].join(" ").toLowerCase().includes(q);
    }
    return [row.providerName, row.state ?? "", row.priority ?? "", row.path ?? "", row.status ?? "", row.initialOrRenewal ?? ""].join(" ").toLowerCase().includes(q);
  });
}

function SortableHeader({ label, field, activeField, direction, onSort, centered = false }: { label: string; field: DetailSortField; activeField: DetailSortField | null; direction: SortDirection; onSort: (field: DetailSortField) => void; centered?: boolean }) {
  const isActive = field === activeField;
  return (
    <th className={cn("sticky top-0 z-10 border-b border-r border-border bg-muted/95 p-2 font-medium backdrop-blur-sm", centered ? "text-center" : "text-left")}>
      <button type="button" onClick={() => onSort(field)} className={cn("inline-flex items-center gap-1 hover:text-foreground", centered ? "justify-center" : "text-left")}>
        {label}
        {isActive ? direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );
}

export function DashboardClient({ providerFacilityRows, facilityPreliveRows, providerLicenseRows, providerVestaPrivilegesRows }: DashboardClientProps) {
  const [view, setView] = useState<ViewKey>("providerFacility");
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [facilityTypeFilter, setFacilityTypeFilter] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState<BooleanFilter>("all");
  const [facilityStateFilter, setFacilityStateFilter] = useState("all");
  const [tempsPossibleFilter, setTempsPossibleFilter] = useState<BooleanFilter>("all");
  const [payorEnrollmentFilter, setPayorEnrollmentFilter] = useState<BooleanFilter>("all");
  const [licensePathFilter, setLicensePathFilter] = useState("all");
  const [licenseCycleFilter, setLicenseCycleFilter] = useState("all");
  const [privilegeTierFilter, setPrivilegeTierFilter] = useState("all");
  const [groupSortField, setGroupSortField] = useState<GroupSortField>("updated");
  const [groupSortDirection, setGroupSortDirection] = useState<SortDirection>("desc");
  const [detailSortField, setDetailSortField] = useState<DetailSortField | null>(null);
  const [detailSortDirection, setDetailSortDirection] = useState<SortDirection>("asc");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const allPriorities = useMemo(
    () =>
      sortPriorities(
        Array.from(
          new Set([...providerFacilityRows.map((r) => r.priority), ...facilityPreliveRows.map((r) => r.priority), ...providerLicenseRows.map((r) => r.priority)].filter(Boolean) as string[]),
        ),
      ),
    [facilityPreliveRows, providerFacilityRows, providerLicenseRows],
  );
  const allStatuses = useMemo(() => Array.from(new Set([...providerFacilityRows.map((r) => r.decision), ...providerLicenseRows.map((r) => r.status)].filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [providerFacilityRows, providerLicenseRows]);
  const allFacilityTypes = useMemo(() => Array.from(new Set(providerFacilityRows.map((row) => row.facilityType).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [providerFacilityRows]);
  const allFacilityStates = useMemo(() => Array.from(new Set([...providerFacilityRows.map((row) => row.facilityState), ...facilityPreliveRows.map((row) => row.facilityState)].filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [facilityPreliveRows, providerFacilityRows]);
  const allLicensePaths = useMemo(() => Array.from(new Set(providerLicenseRows.map((row) => row.path).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [providerLicenseRows]);
  const allLicenseCycles = useMemo(() => Array.from(new Set(providerLicenseRows.map((row) => row.initialOrRenewal).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [providerLicenseRows]);
  const allPrivilegeTiers = useMemo(() => Array.from(new Set(providerVestaPrivilegesRows.map((row) => row.privilegeTier).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [providerVestaPrivilegesRows]);

  const filteredProviderFacility = useMemo(
    () =>
      providerFacilityRows.filter(
        (row) =>
          (priorityFilter === "all" || normalize(row.priority) === normalize(priorityFilter))
          && (statusFilter === "all" || normalize(row.decision) === normalize(statusFilter))
          && (facilityTypeFilter === "all" || normalize(row.facilityType) === normalize(facilityTypeFilter))
          && matchesBooleanFilter(row.applicationRequired, applicationFilter)
          && (facilityStateFilter === "all" || normalize(row.facilityState) === normalize(facilityStateFilter)),
      ),
    [applicationFilter, facilityStateFilter, facilityTypeFilter, priorityFilter, providerFacilityRows, statusFilter],
  );
  const filteredPrelive = useMemo(
    () =>
      facilityPreliveRows.filter(
        (row) =>
          (priorityFilter === "all" || normalize(row.priority) === normalize(priorityFilter))
          && (facilityStateFilter === "all" || normalize(row.facilityState) === normalize(facilityStateFilter))
          && matchesBooleanFilter(row.tempsPossible, tempsPossibleFilter)
          && matchesBooleanFilter(row.payorEnrollmentRequired, payorEnrollmentFilter),
      ),
    [facilityPreliveRows, facilityStateFilter, payorEnrollmentFilter, priorityFilter, tempsPossibleFilter],
  );
  const filteredLicenses = useMemo(
    () =>
      providerLicenseRows.filter(
        (row) =>
          (priorityFilter === "all" || normalize(row.priority) === normalize(priorityFilter))
          && (statusFilter === "all" || normalize(row.status) === normalize(statusFilter))
          && (licensePathFilter === "all" || normalize(row.path) === normalize(licensePathFilter))
          && (licenseCycleFilter === "all" || normalize(row.initialOrRenewal) === normalize(licenseCycleFilter)),
      ),
    [licenseCycleFilter, licensePathFilter, priorityFilter, providerLicenseRows, statusFilter],
  );
  const filteredVestaPrivileges = useMemo(
    () =>
      providerVestaPrivilegesRows.filter(
        (row) =>
          privilegeTierFilter === "all" || normalize(row.privilegeTier) === normalize(privilegeTierFilter),
      ),
    [providerVestaPrivilegesRows, privilegeTierFilter],
  );

  const providerGroups = useMemo(() => {
    const grouped = groupBy(
      filteredProviderFacility,
      (row) => row.providerId ?? row.providerName,
      (row) => row.providerName,
      (row) => row.providerDegree ?? undefined,
    );
    if (groupSortField === "name") {
      return sortByDirection(grouped, groupSortDirection, (row) => row.label.toLowerCase());
    }
    return sortByDirection(grouped, groupSortDirection, (row) => {
      const first = row.rows[0] as { updatedAt?: string | null } | undefined;
      return first?.updatedAt ? new Date(first.updatedAt).getTime() : 0;
    });
  }, [filteredProviderFacility, groupSortDirection, groupSortField]);

  const facilityGroups = useMemo(() => {
    const grouped = groupBy(
      filteredProviderFacility,
      (row) => row.facilityId ?? row.facilityName,
      (row) => row.facilityName,
      (row) => row.facilityState ?? undefined,
    );
    if (groupSortField === "name") {
      return sortByDirection(grouped, groupSortDirection, (row) => row.label.toLowerCase());
    }
    return sortByDirection(grouped, groupSortDirection, (row) => {
      const first = row.rows[0] as { updatedAt?: string | null } | undefined;
      return first?.updatedAt ? new Date(first.updatedAt).getTime() : 0;
    });
  }, [filteredProviderFacility, groupSortDirection, groupSortField]);

  const preliveGroups = useMemo(() => {
    const grouped = groupBy(
      filteredPrelive,
      (row) => row.facilityId ?? row.facilityName,
      (row) => row.facilityName,
      (row) => row.facilityState ?? undefined,
    );
    if (groupSortField === "name") {
      return sortByDirection(grouped, groupSortDirection, (row) => row.label.toLowerCase());
    }
    return sortByDirection(grouped, groupSortDirection, (row) => {
      const first = row.rows[0] as { updatedAt?: string | null } | undefined;
      return first?.updatedAt ? new Date(first.updatedAt).getTime() : 0;
    });
  }, [filteredPrelive, groupSortDirection, groupSortField]);

  const licenseGroups = useMemo(() => {
    const grouped = groupBy(
      filteredLicenses,
      (row) => row.providerId ?? row.providerName,
      (row) => row.providerName,
      (row) => row.providerDegree ?? undefined,
    );
    if (groupSortField === "name") {
      return sortByDirection(grouped, groupSortDirection, (row) => row.label.toLowerCase());
    }
    return sortByDirection(grouped, groupSortDirection, (row) => {
      const first = row.rows[0] as { updatedAt?: string | null } | undefined;
      return first?.updatedAt ? new Date(first.updatedAt).getTime() : 0;
    });
  }, [filteredLicenses, groupSortDirection, groupSortField]);

  const vestaPrivilegeGroups = useMemo(() => {
    const grouped = groupBy(
      filteredVestaPrivileges,
      (row) => row.providerId ?? row.providerName ?? "unknown",
      (row) => row.providerName ?? "Unnamed Provider",
      (row) => row.providerDegree ?? undefined,
    );

    if (groupSortField === "name") {
      return sortByDirection(grouped, groupSortDirection, (row) => row.label.toLowerCase());
    }

    return sortByDirection(grouped, groupSortDirection, (row) => {
      const first = row.rows[0] as { updatedAt?: string | null } | undefined;
      return first?.updatedAt ? new Date(first.updatedAt).getTime() : 0;
    });
  }, [filteredVestaPrivileges, groupSortDirection, groupSortField]);

  const groupsForView = useMemo(() => {
    if (view === "providerFacility") return providerGroups;
    if (view === "facilityProvider") return facilityGroups;
    if (view === "facilityPrelive") return preliveGroups;
    if (view === "providerLicense") return licenseGroups;
    if (view === "providerVestaPrivileges") return vestaPrivilegeGroups;
    return [];
  }, [facilityGroups, licenseGroups, preliveGroups, providerGroups, vestaPrivilegeGroups, view]);

  const activeGroups = useMemo(() => {
    const q = normalize(leftSearch);
    if (!q) return groupsForView;
    return groupsForView.filter((group) => `${group.label} ${group.subtitle ?? ""}`.toLowerCase().includes(q));
  }, [groupsForView, leftSearch]);

  useEffect(() => {
    if (activeGroups.length === 0) return setSelectedKey(null);
    if (!selectedKey || !activeGroups.some((group) => group.key === selectedKey)) setSelectedKey(activeGroups[0]?.key ?? null);
  }, [activeGroups, selectedKey]);

  const selectedGroup = useMemo(() => activeGroups.find((group) => group.key === selectedKey) ?? null, [activeGroups, selectedKey]);

  const selectedRows = useMemo(() => {
    if (view === "providerVestaPrivileges") {
      const rows = rowsMatchSearch(filteredVestaPrivileges, rightSearch);
      return sortByDirection(rows as ProviderVestaPrivilegesRow[], detailSortDirection, (row) => {
        if (detailSortField === "status") return row.privilegeTier ?? "";
        if (detailSortField === "requested") return row.currentPrivInitDate ? new Date(row.currentPrivInitDate).getTime() : 0;
        if (detailSortField === "finalDate") return row.currentPrivEndDate ? new Date(row.currentPrivEndDate).getTime() : 0;
        if (detailSortField === "provider") return row.providerName ?? "";
        return 0;
      });
    }

    if (!selectedGroup) return [];
    const rows = rowsMatchSearch(selectedGroup.rows, rightSearch);
    if (!detailSortField) return rows;
    if (view === "providerFacility" || view === "facilityProvider") {
      return sortByDirection(rows as ProviderFacilityRow[], detailSortDirection, (row) => {
        if (detailSortField === "facility") return row.facilityName;
        if (detailSortField === "provider") return row.providerName;
        if (detailSortField === "priority") return priorityRank(row.priority);
        if (detailSortField === "privileges") return row.privileges ?? "";
        if (detailSortField === "status") return row.decision ?? "";
        if (detailSortField === "type") return row.facilityType ?? "";
        if (detailSortField === "application") return row.applicationRequired === null ? -1 : Number(row.applicationRequired);
        return 0;
      });
    }
    if (view === "providerLicense") {
      return sortByDirection(rows as ProviderLicenseRow[], detailSortDirection, (row) => {
        if (detailSortField === "state") return row.state ?? "";
        if (detailSortField === "priority") return priorityRank(row.priority);
        if (detailSortField === "path") return row.path ?? "";
        if (detailSortField === "status") return row.status ?? "";
        if (detailSortField === "initialOrRenewal") return row.initialOrRenewal ?? "";
        if (detailSortField === "requested") return row.startsAt ? new Date(row.startsAt).getTime() : 0;
        if (detailSortField === "finalDate") return row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
        return 0;
      });
    }
    return rows;
  }, [detailSortDirection, detailSortField, rightSearch, selectedGroup, view, filteredVestaPrivileges]);

  const onHeaderSort = (field: DetailSortField) => {
    if (detailSortField === field) {
      setDetailSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setDetailSortField(field);
    setDetailSortDirection("asc");
  };

  const resetFilters = () => {
    setPriorityFilter("all");
    setStatusFilter("all");
    setFacilityTypeFilter("all");
    setApplicationFilter("all");
    setFacilityStateFilter("all");
    setTempsPossibleFilter("all");
    setPayorEnrollmentFilter("all");
    setLicensePathFilter("all");
    setLicenseCycleFilter("all");
    setPrivilegeTierFilter("all");
    setGroupSortField("updated");
    setGroupSortDirection("desc");
    setDetailSortField(null);
    setDetailSortDirection("asc");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border p-3">
        <div className="w-full">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {viewButtons.map((button) => (
              <Button
                key={button.key}
                size="sm"
                variant={view === button.key ? "default" : "outline"}
                className={cn("w-full", view !== button.key && "border-border")}
                onClick={() => {
                  setView(button.key);
                  setSelectedKey(null);
                  setLeftSearch("");
                  setRightSearch("");
                  setDetailSortField(null);
                }}
              >
                {button.label}
              </Button>
            ))}
          </div>

        </div>
      </div>

      <div className={cn(
        "grid min-h-0 flex-1 grid-cols-1",
        view !== "providerVestaPrivileges" && "md:grid-cols-[330px_1fr]"
      )}>
        {view !== "providerVestaPrivileges" && (
          <div className="flex min-h-0 flex-col border-r border-border p-3">
            <Input placeholder={view === "providerFacility" || view === "providerLicense" ? "Search providers" : "Search facilities"} value={leftSearch} onChange={(event) => setLeftSearch(event.target.value)} className="mb-3" />
            <div className="hide-scrollbar min-h-0 flex-1 overflow-auto">
              {activeGroups.length === 0 ? <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">No records match the current filters.</div> : (
                <div className="space-y-1">
                  {activeGroups.map((group) => (
                    <button key={group.key} type="button" onClick={() => setSelectedKey(group.key)} className={cn("w-full rounded-md border px-3 py-2 text-left transition", selectedGroup?.key === group.key ? "border-primary/60 bg-primary/10" : "border-border hover:bg-muted/40")}>
                      <div className="flex items-center justify-between gap-2">
                        <TruncatedTooltip text={group.label} className="font-medium" />
                        {group.subtitle ? <div className="text-xs text-muted-foreground">{group.subtitle}</div> : null}
                      </div>
                    </button>
                  ))}
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                    <span className="h-px w-6 bg-border" />
                    {activeGroups.length} of {groupsForView.length} shown
                    <span className="h-px w-6 bg-border" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-col p-3">
          <div className="mb-3 flex items-center gap-2">
            <Input placeholder="Search selected details" value={rightSearch} onChange={(event) => setRightSearch(event.target.value)} />
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0">
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Dashboard filters</SheetTitle>
                <SheetDescription>Filter and sort the active dashboard view.</SheetDescription>
              </SheetHeader>

              <div className="hide-scrollbar flex flex-1 flex-col gap-4 overflow-auto px-4 pb-4">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Filtering</h3>
                  {view !== "providerVestaPrivileges" && (
                    <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                      <label className="text-sm text-muted-foreground">Priority</label>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Priorities</SelectItem>
                          {allPriorities.map((priority) => (
                            <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {(view === "providerFacility" || view === "facilityProvider" || view === "providerLicense") && (
                    <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                      <label className="text-sm text-muted-foreground">Status</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {allStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(view === "providerFacility" || view === "facilityProvider" || view === "facilityPrelive") && (
                    <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                      <label className="text-sm text-muted-foreground">State</label>
                      <Select value={facilityStateFilter} onValueChange={setFacilityStateFilter}>
                        <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All States</SelectItem>
                          {allFacilityStates.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(view === "providerFacility" || view === "facilityProvider") && (
                    <>
                      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                        <label className="text-sm text-muted-foreground">Facility Type</label>
                        <Select value={facilityTypeFilter} onValueChange={setFacilityTypeFilter}>
                          <SelectTrigger><SelectValue placeholder="Facility type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {allFacilityTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                        <label className="text-sm text-muted-foreground">Application</label>
                        <Select value={applicationFilter} onValueChange={(value) => setApplicationFilter(value as BooleanFilter)}>
                          <SelectTrigger><SelectValue placeholder="Application" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {view === "facilityPrelive" && (
                    <>
                      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                        <label className="text-sm text-muted-foreground">Temps Possible</label>
                        <Select value={tempsPossibleFilter} onValueChange={(value) => setTempsPossibleFilter(value as BooleanFilter)}>
                          <SelectTrigger><SelectValue placeholder="Temps possible" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                        <label className="text-sm text-muted-foreground">Payor Enrollment</label>
                        <Select value={payorEnrollmentFilter} onValueChange={(value) => setPayorEnrollmentFilter(value as BooleanFilter)}>
                          <SelectTrigger><SelectValue placeholder="Payor enrollment" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {view === "providerLicense" && (
                    <>
                      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                        <label className="text-sm text-muted-foreground">Path</label>
                        <Select value={licensePathFilter} onValueChange={setLicensePathFilter}>
                          <SelectTrigger><SelectValue placeholder="Path" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Paths</SelectItem>
                            {allLicensePaths.map((path) => <SelectItem key={path} value={path}>{path}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                        <label className="text-sm text-muted-foreground">Cycle</label>
                        <Select value={licenseCycleFilter} onValueChange={setLicenseCycleFilter}>
                          <SelectTrigger><SelectValue placeholder="Initial / renewal" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Cycles</SelectItem>
                            {allLicenseCycles.map((cycle) => <SelectItem key={cycle} value={cycle}>{cycle}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {view === "providerVestaPrivileges" && (
                    <>
                      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                        <label className="text-sm text-muted-foreground">Privilege Tier</label>
                        <Select value={privilegeTierFilter} onValueChange={setPrivilegeTierFilter}>
                          <SelectTrigger><SelectValue placeholder="Privilege Tier" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Tiers</SelectItem>
                            {allPrivilegeTiers.map((tier) => <SelectItem key={tier} value={tier}>{tier}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Sorting</h3>
                  <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                    <label className="text-sm text-muted-foreground">Sort by</label>
                    <Select value={groupSortField} onValueChange={(value) => setGroupSortField(value as GroupSortField)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="updated">Updated date</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                    <label className="text-sm text-muted-foreground">Direction</label>
                    <Select value={groupSortDirection} onValueChange={(value) => setGroupSortDirection(value as SortDirection)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </section>
              </div>

              <div className="mt-auto px-4 pb-4">
                <Separator className="mb-4" />
                <Button variant="outline" className="w-full" onClick={resetFilters}>Reset filters</Button>
              </div>
            </SheetContent>
          </Sheet>
          </div>
          <div className="hide-scrollbar min-h-0 flex-1 overflow-auto rounded-md border border-border">
            {!selectedGroup ? <div className="p-4 text-sm text-muted-foreground">Select an item to view details.</div> : (
              <>
                {selectedRows.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No rows match that detail search.</div> : null}

                {(view === "providerFacility" || view === "facilityProvider") && selectedRows.length > 0 && (
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <SortableHeader label={view === "providerFacility" ? "Facility" : "Provider"} field={view === "providerFacility" ? "facility" : "provider"} activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} />
                        <SortableHeader label="Priority" field="priority" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Privileges" field="privileges" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Status" field="status" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Type" field="type" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        {view === "providerFacility" ? <SortableHeader label="Application" field="application" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRows as ProviderFacilityRow[]).map((row) => (
                        <tr key={row.id} className="border-t border-border transition-colors hover:bg-muted/30">
                          <td className="border-r border-border p-2">{view === "providerFacility" ? row.facilityName : row.providerName}</td>
                          <td className="border-r border-border p-2 text-center"><Badge variant="outline" className={cn("rounded-sm", priorityTone(row.priority))}>{row.priority ?? "—"}</Badge></td>
                          <td className="border-r border-border p-2 text-center">{row.privileges ?? "—"}</td>
                          <td className="border-r border-border p-2 text-center"><Badge variant="outline" className={cn("rounded-sm", statusTone(row.decision))}>{row.decision ?? "—"}</Badge></td>
                          <td className="border-r border-border p-2 text-center">{row.facilityType ?? "—"}</td>
                          {view === "providerFacility" ? <td className="p-2 text-center">{row.applicationRequired === null ? "—" : row.applicationRequired ? "Yes" : "No"}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {view === "facilityPrelive" && selectedRows.length > 0 && (
                  <div className="space-y-2 p-2">
                    {(selectedRows as FacilityPreliveRow[]).map((row) => (
                      <div key={row.id} className="rounded-md border border-border p-2">
                        <div className="grid gap-2 md:grid-cols-5">
                          <div>
                            <div className="text-xs text-muted-foreground">Priority</div>
                            <Badge variant="outline" className={cn("mt-1 rounded-sm", priorityTone(row.priority))}>{row.priority ?? "—"}</Badge>
                          </div>
                          <div><div className="text-xs text-muted-foreground">Go Live Date</div><div className="mt-1 text-sm">{formatDate(row.goLiveDate)}</div></div>
                          <div><div className="text-xs text-muted-foreground">Credentialing Due</div><div className="mt-1 text-sm">{formatDate(row.credentialingDueDate)}</div></div>
                          <div><div className="text-xs text-muted-foreground">Board Meeting</div><div className="mt-1 text-sm">{formatDate(row.boardMeetingDate)}</div></div>
                          <div><div className="text-xs text-muted-foreground">Temps Possible</div><div className="mt-1 text-sm">{row.tempsPossible === null ? "—" : row.tempsPossible ? "Yes" : "No"}</div></div>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <div><div className="text-xs text-muted-foreground">Payor Enrollment Required</div><div className="mt-1 text-sm">{row.payorEnrollmentRequired === null ? "—" : row.payorEnrollmentRequired ? "Yes" : "No"}</div></div>
                          <div><div className="text-xs text-muted-foreground">Roles Needed</div><div className="mt-1 text-sm">{row.rolesNeeded.length ? row.rolesNeeded.join(", ") : "—"}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {view === "providerLicense" && selectedRows.length > 0 && (
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <SortableHeader label="State" field="state" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Priority" field="priority" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Path" field="path" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Status" field="status" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Initial / Renewal" field="initialOrRenewal" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Requested" field="requested" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Final Date" field="finalDate" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRows as ProviderLicenseRow[]).map((row) => (
                        <tr key={row.id} className="border-t border-border transition-colors hover:bg-muted/30">
                          <td className="border-r border-border p-2 text-center">{row.state ?? "—"}</td>
                          <td className="border-r border-border p-2 text-center"><Badge variant="outline" className={cn("rounded-sm", priorityTone(row.priority))}>{row.priority ?? "—"}</Badge></td>
                          <td className="border-r border-border p-2 text-center">{row.path ?? "—"}</td>
                          <td className="border-r border-border p-2 text-center"><Badge variant="outline" className={cn("rounded-sm", statusTone(row.status))}>{row.status ?? "—"}</Badge></td>
                          <td className="border-r border-border p-2 text-center">{row.initialOrRenewal ?? "—"}</td>
                          <td className="border-r border-border p-2 text-center">{formatDate(row.startsAt)}</td>
                          <td className="p-2 text-center">{formatDate(row.expiresAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {view === "providerVestaPrivileges" && selectedRows.length > 0 && (
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <SortableHeader label="Provider" field="provider" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} />
                        <SortableHeader label="Privilege Tier" field="status" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Initial Date" field="requested" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <SortableHeader label="Expiration Date" field="finalDate" activeField={detailSortField} direction={detailSortDirection} onSort={onHeaderSort} centered />
                        <th className="sticky top-0 z-10 border-b border-r border-border bg-muted/95 p-2 font-medium backdrop-blur-sm text-center">Term Date</th>
                        <th className="sticky top-0 z-10 border-b border-r border-border bg-muted/95 p-2 font-medium backdrop-blur-sm text-left">Term Reason</th>
                        <th className="sticky top-0 z-10 border-b border-border bg-muted/95 p-2 font-medium backdrop-blur-sm text-center">Past Privileges</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRows as ProviderVestaPrivilegesRow[]).map((row) => (
                        <tr key={row.id} className="border-t border-border transition-colors hover:bg-muted/30">
                          <td className="border-r border-border p-2 font-medium">{row.providerName ?? "Unnamed Provider"}</td>
                          <td className="border-r border-border p-2 text-center">
                            <Badge variant="outline" className={cn("rounded-sm", statusTone(row.privilegeTier))}>
                              {row.privilegeTier ?? "—"}
                            </Badge>
                          </td>
                          <td className="border-r border-border p-2 text-center">{formatDate(row.currentPrivInitDate)}</td>
                          <td className="border-r border-border p-2 text-center">{formatDate(row.currentPrivEndDate)}</td>
                          <td className="border-r border-border p-2 text-center">{formatDate(row.termDate)}</td>
                          <td className="border-r border-border p-2 text-left text-muted-foreground italic">{row.termReason ?? "—"}</td>
                          <td className="p-2 text-center">
                            {row.pastPrivileges && row.pastPrivileges.length > 0 ? (
                              <Sheet>
                                <SheetTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 text-xs">
                                    History ({row.pastPrivileges.length})
                                  </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="sm:max-w-md border-l border-border shadow-2xl">
                                  <SheetHeader className="pb-6 border-b border-border">
                                    <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                                      Privilege History
                                    </SheetTitle>
                                    <SheetDescription className="text-sm">
                                      Verified historical records for <br></br><span className="font-semibold text-primary">{row.providerName}</span>
                                    </SheetDescription>
                                  </SheetHeader>

                                  <div className="mt-8 h-[calc(100vh-180px)] overflow-y-auto px-4 hide-scrollbar">
                                    <div className="space-y-4">
                                      {row.pastPrivileges?.map((item, i) => (
                                        <div 
                                          key={i} 
                                          className="rounded-xl border border-border bg-muted/20 p-5 transition-colors"
                                        >
                                          <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                              <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                Archived Record
                                              </span>
                                            </div>
                                            <span className="text-[10px] font-mono tabular-nums text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/50">
                                              {new Date(item.approved_at).getFullYear()}
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-1">
                                              <p className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest">
                                                Effective
                                              </p>
                                              <p className="text-sm font-medium text-foreground">
                                                {formatDate(item.approved_at)}
                                              </p>
                                            </div>
                                            <div className="space-y-1">
                                              <p className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest">
                                                Expired
                                              </p>
                                              <p className="text-sm font-medium text-foreground">
                                                {formatDate(item.expires_at)}
                                              </p>
                                            </div>
                                          </div>

                                          {item.tier && (
                                            <div className="mt-4 pt-4 border-t border-border/30">
                                              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                                                <span>Tier Held</span>
                                                <span className="text-foreground">{item.tier}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}

                                      {(!row.pastPrivileges || row.pastPrivileges.length === 0) && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                          <p className="text-sm font-medium text-muted-foreground">No historical records found</p>
                                          <p className="text-xs text-muted-foreground/60">This provider has no prior Vesta history.</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </SheetContent>
                              </Sheet>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {selectedRows.length > 0 && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                    <span className="h-px w-6 bg-border" />
                    End of list · {selectedRows.length} {selectedRows.length === 1 ? "record" : "records"}
                    <span className="h-px w-6 bg-border" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Search,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Star,
  User,
  Filter,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  Table as TableIcon,
  Loader2,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

// ─── Types ──────────────────────────────────────────────────────
interface FacilityContact {
  id: string;
  facilityId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

type FacilityStatus = "Inactive" | "Active" | "In Progress";

interface Facility {
  id: string;
  name: string | null;
  state: string | null;
  proxy: string | null;
  status: FacilityStatus | null;
  email: string | null;
  address: string | null;
  yearlyVolume: number | null;
  modalities: string[] | null;
  tatSla: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  contacts: FacilityContact[];
}

type ViewMode = "table" | "grid";

interface FacilitiesClientProps {
  facilities: Facility[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
  activeOnly: boolean;
  contactsFilter: string;
}

// ─── Contacts panel (shared between views) ──────────────────────
function ContactsPanel({ contacts }: { contacts: FacilityContact[] }) {
  if (!contacts.length) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        No contacts for this facility.
      </p>
    );
  }

  return (
    <div className="py-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider">
        Contacts ({contacts.length})
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {contacts
          .sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return (a.name ?? "").localeCompare(b.name ?? "");
          })
          .map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-1 rounded-md border bg-background p-3 text-sm"
            >
              <div className="flex items-center gap-2 font-medium">
                <User className="h-3.5 w-3.5" />
                {c.name ?? "—"}
                {c.isPrimary && (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-600 border-amber-500/25"
                  >
                    <Star className="h-2.5 w-2.5" /> Primary
                  </Badge>
                )}
              </div>
              {c.title && (
                <span className="text-xs">{c.title}</span>
              )}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {c.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </span>
                )}
                {c.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Status badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: FacilityStatus | null }) {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "active") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/25 dark:text-emerald-400">
        Active
      </Badge>
    );
  }
  if (normalized === "in progress") {
    return (
      <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/25 dark:text-blue-400">
        In Progress
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      {status ?? "Inactive"}
    </Badge>
  );
}

// ─── Main client component ──────────────────────────────────────
export function FacilitiesClient({
  facilities: rows,
  total,
  page,
  pageSize,
  totalPages,
  search: initialSearch,
  activeOnly: initialActiveOnly,
  contactsFilter: initialContactsFilter,
}: FacilitiesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("facilities-view") as ViewMode) ?? "table";
    }
    return "table";
  });
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  // ─── URL-based navigation ─────────────────────────────────────
  const navigate = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === "" || value === "false") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    // Reset page when search/filter changes
    if ("search" in overrides || "active" in overrides || "contacts" in overrides || "size" in overrides) {
      params.delete("page");
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(`/facilities${qs ? `?${qs}` : ""}`);
    });
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => {
      navigate({ search: value || undefined });
    }, 300);
    setTimer(t);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Page numbers ─────────────────────────────────────────────
  const pageNumbers = (() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  return (
    <div className="space-y-6 relative">
      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Facilities</h1>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString()} total facilities
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setViewMode("table");
                  localStorage.setItem("facilities-view", "table");
                }}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Table view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setViewMode("grid");
                  localStorage.setItem("facilities-view", "grid");
                }}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Card view</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, state, email, address…"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 pr-9"
            disabled={isPending}
          />
          {isPending && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={initialActiveOnly ? "default" : "outline"}
              size="sm"
              onClick={() =>
                navigate({ active: initialActiveOnly ? undefined : "true" })
              }
              className="gap-1.5"
              disabled={isPending}
            >
              <Filter className="h-3.5 w-3.5" />
              Active Only
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {initialActiveOnly
              ? "Showing active only"
              : "Showing all facilities"}
          </TooltipContent>
        </Tooltip>

        <Select
          value={initialContactsFilter}
          onValueChange={(v) => navigate({ contacts: v === "all" ? undefined : v })}
          disabled={isPending}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Facilities</SelectItem>
            <SelectItem value="with">With Contacts</SelectItem>
            <SelectItem value="without">No Contacts</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={String(pageSize)}
          onValueChange={(v) => navigate({ size: v })}
          disabled={isPending}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="15">15 per page</SelectItem>
            <SelectItem value="20">20 per page</SelectItem>
            <SelectItem value="30">30 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table View ────────────────────────────────────────── */}
      {viewMode === "table" && (
        <div className={`rounded-lg border overflow-x-auto transition-opacity duration-200 ${isPending ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                  State
                </TableHead>
                <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wider">
                  Proxy
                </TableHead>
                <TableHead className="hidden lg:table-cell text-xs font-semibold uppercase tracking-wider">
                  Email
                </TableHead>
                <TableHead className="hidden xl:table-cell text-xs font-semibold uppercase tracking-wider">
                  Address
                </TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                  Contacts
                </TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Building2 className="h-8 w-8 opacity-40" />
                      <p className="text-sm">No facilities found.</p>
                      {initialSearch && (
                        <p className="text-xs">
                          Try adjusting your search terms.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((f) => {
                  const isExpanded = expandedRows.has(f.id);
                  return (
                    <Fragment key={f.id}>
                      <TableRow
                        className={`group ${isExpanded ? "border-b-0" : ""}`}
                      >
                        <TableCell className="w-10">
                          <button
                            onClick={() => toggleRow(f.id)}
                            className="rounded p-1 hover:bg-muted/50 transition-colors"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {f.name?.trim() ?? "—"}
                        </TableCell>
                        <TableCell>
                          {f.state ? (
                            <Badge variant="outline" className="text-xs">
                              {f.state}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {f.proxy ?? "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {f.email ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {f.email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {f.address ? (
                            <span className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              <span className="max-w-[200px] truncate">
                                {f.address}
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {f.contacts.length > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              {f.contacts.length}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={f.status} />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow
                          key={`contacts-${f.id}`}
                          className="bg-muted/30 hover:bg-muted/30"
                        >
                          <TableCell colSpan={8} className="px-12 py-2">
                            <ContactsPanel contacts={f.contacts} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Grid / Card View ──────────────────────────────────── */}
      {viewMode === "grid" && (
        <div className={`transition-opacity duration-200 ${isPending ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              No facilities found.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((f) => {
                const isExpanded = expandedRows.has(f.id);
                return (
                  <article
                    key={f.id}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold">
                        {f.name?.trim() ?? "Unnamed Facility"}
                      </h2>
                      <StatusBadge status={f.status} />
                    </div>
                    <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <div className="flex justify-between gap-2">
                        <dt>State</dt>
                        <dd>{f.state ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Email</dt>
                        <dd className="truncate">{f.email ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Proxy</dt>
                        <dd>{f.proxy ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Address</dt>
                        <dd className="text-foreground">
                          {f.address ?? "—"}
                        </dd>
                      </div>
                    </dl>

                    {/* Contacts toggle */}
                    {f.contacts.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <button
                          onClick={() => toggleRow(f.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {f.contacts.length} Contact
                          {f.contacts.length !== 1 ? "s" : ""}
                        </button>
                        {isExpanded && (
                          <div className="mt-2">
                            <ContactsPanel contacts={f.contacts} />
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Pagination ──────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            {((page - 1) * pageSize + 1).toLocaleString()}–
            {Math.min(page * pageSize, total).toLocaleString()} of{" "}
            {total.toLocaleString()} facilities
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1 || isPending}
              onClick={() => navigate({ page: "1" })}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1 || isPending}
              onClick={() =>
                navigate({ page: String(Math.max(1, page - 1)) })
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNumbers[0]! > 1 && (
              <span className="px-1 text-xs text-muted-foreground">…</span>
            )}
            {pageNumbers.map((p) => (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="icon"
                className="h-8 w-8 text-xs"
                onClick={() => navigate({ page: String(p) })}
                disabled={isPending}
              >
                {p}
              </Button>
            ))}
            {pageNumbers[pageNumbers.length - 1]! < totalPages && (
              <span className="px-1 text-xs text-muted-foreground">…</span>
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages || isPending}
              onClick={() =>
                navigate({ page: String(Math.min(totalPages, page + 1)) })
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages || isPending}
              onClick={() =>
                navigate({ page: String(totalPages) })
              }
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

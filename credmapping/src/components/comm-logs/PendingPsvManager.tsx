"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";
import { StandardEmptyState } from "./StandardEmptyState";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { TruncatedTooltip } from "~/components/ui/truncated-tooltip";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { api } from "~/trpc/react";
import { ScrollIndicatorContainer } from "~/components/ui/scroll-indicator-container";

type PendingPsv = {
  id: string;
  status:
    | "Not Started"
    | "Requested"
    | "Received"
    | "Inactive Rad"
    | "Closed"
    | "Not Affiliated"
    | "Old Request"
    | "Hold";
  type:
    | "Education"
    | "Work"
    | "Hospital"
    | "Peer"
    | "COI/Loss Run"
    | "Claims Document"
    | "Board Actions"
    | "Locums/Work"
    | "Vesta Practice Location"
    | "Vesta Hospital"
    | "Work COI"
    | "OPPE";
  name: string;
  dateRequested: string;
  nextFollowUp: string | null;
  notes: string | null;
};

interface PendingPsvManagerProps {
  providerId: string;
  psvs: PendingPsv[] | undefined;
  isLoading: boolean;
  onChanged: () => Promise<void> | void;
}

const PSV_STATUSES: Exclude<PendingPsv["status"], "Closed">[] = [
  "Not Started",
  "Requested",
  "Received",
  "Inactive Rad",
  "Not Affiliated",
  "Old Request",
  "Hold",
];
const PSV_TYPES: PendingPsv["type"][] = [
  "Education",
  "Work",
  "Hospital",
  "Peer",
  "COI/Loss Run",
  "Claims Document",
  "Board Actions",
  "Locums/Work",
  "Vesta Practice Location",
  "Vesta Hospital",
  "Work COI",
  "OPPE",
];

const defaultForm = {
  status: "Requested" as Exclude<PendingPsv["status"], "Closed">,
  type: "Education" as PendingPsv["type"],
  name: "",
  dateRequested: "",
  nextFollowUp: "",
  notes: "",
};

export function PendingPsvManager({
  providerId,
  psvs,
  isLoading,
  onChanged,
}: PendingPsvManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "closed" | "all">(
    "active",
  );
  const [typeFilter, setTypeFilter] = useState<"all" | PendingPsv["type"]>(
    "all",
  );
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const createMutation = api.commLogs.createPendingPSV.useMutation();
  const updateMutation = api.commLogs.updatePendingPSV.useMutation();
  const isMutating = createMutation.isPending || updateMutation.isPending;
  const isCreating = isEditing && !editingId;

  const filteredPsvs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const rows = [...(psvs ?? [])]
      .filter((psv) => {
        if (statusFilter === "all") return true;
        return statusFilter === "closed"
          ? psv.status === "Closed"
          : psv.status !== "Closed";
      })
      .filter((psv) => typeFilter === "all" || psv.type === typeFilter)
      .filter((psv) => {
        if (!query) return true;
        return [psv.name, psv.notes, psv.status, psv.type]
          .filter((v): v is string => Boolean(v))
          .some((v) => v.toLowerCase().includes(query));
      });

    rows.sort((a, b) => {
      const valueA = new Date(a.dateRequested).getTime();
      const valueB = new Date(b.dateRequested).getTime();
      return sortOrder === "newest" ? valueB - valueA : valueA - valueB;
    });

    return rows;
  }, [psvs, searchQuery, sortOrder, statusFilter, typeFilter]);

  const resetEditor = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const beginCreate = () => {
    setIsEditing(true);
    setEditingId(null);
    setForm(defaultForm);
  };

  const beginEdit = (psv: PendingPsv) => {
    setIsEditing(true);
    setEditingId(psv.id);
    setForm({
      status: psv.status === "Closed" ? "Requested" : psv.status,
      type: psv.type,
      name: psv.name,
      dateRequested: psv.dateRequested,
      nextFollowUp: psv.nextFollowUp ?? "",
      notes: psv.notes ?? "",
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.dateRequested) return;

    const payload = {
      status: form.status,
      type: form.type,
      name: form.name,
      dateRequested: form.dateRequested,
      nextFollowUp: form.nextFollowUp || undefined,
      notes: form.notes || undefined,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMutation.mutateAsync({ providerId, ...payload });
    }

    await onChanged();
    resetEditor();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border bg-card sticky top-0 z-10 border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 min-w-60 flex-1"
            placeholder="Search PSV tasks..."
          />
          <div className="ml-auto flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-9">
                  <SlidersHorizontal className="size-4" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent className="gap-0">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    PSV Filters and Sort
                  </SheetTitle>
                </SheetHeader>
                <div className="border-border space-y-4 border-t px-4 py-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as "active" | "closed" | "all",
                        )
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                    >
                      <option value="active">Active</option>
                      <option value="closed">Archived</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) =>
                        setTypeFilter(
                          e.target.value as "all" | PendingPsv["type"],
                        )
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                    >
                      <option value="all">All Types</option>
                      {PSV_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Sort</label>
                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "newest" | "oldest")
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                    >
                      <option value="newest">Requested Date (Newest)</option>
                      <option value="oldest">Requested Date (Oldest)</option>
                    </select>
                  </div>
                </div>
                <SheetFooter className="px-4 py-4">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setStatusFilter("active");
                      setTypeFilter("all");
                      setSortOrder("newest");
                      setSearchQuery("");
                    }}
                  >
                    Reset filters
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Button size="sm" className="h-9" onClick={beginCreate}>
              + Add PSV
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        {isCreating && (
          <div className="mb-4 grid gap-3 rounded-lg border border-zinc-700 bg-zinc-900/40 p-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">
                PSV Verification Type
              </label>
              <select
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                value={form.type}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    type: e.target.value as PendingPsv["type"],
                  }))
                }
              >
                {PSV_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">PSV Status</label>
              <select
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                value={form.status}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    status: e.target.value as Exclude<
                      PendingPsv["status"],
                      "Closed"
                    >,
                  }))
                }
              >
                {PSV_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Date Requested</label>
              <Input
                type="date"
                value={form.dateRequested}
                onChange={(e) =>
                  setForm((s) => ({ ...s, dateRequested: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-zinc-400">
                Verification Target / Contact Name
              </label>
              <Input
                placeholder="e.g. Residency Program - Duke"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">
                Next Follow-up Date
              </label>
              <Input
                type="date"
                value={form.nextFollowUp}
                onChange={(e) =>
                  setForm((s) => ({ ...s, nextFollowUp: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs text-zinc-400">Notes</label>
              <Textarea
                rows={3}
                placeholder="Follow-up details, outcomes, blockers"
                value={form.notes}
                onChange={(e) =>
                  setForm((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 md:col-span-3">
              <Button variant="outline" onClick={resetEditor}>
                Cancel
              </Button>
              <Button
                disabled={
                  isMutating || !form.name.trim() || !form.dateRequested
                }
                onClick={save}
              >
                {editingId ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-zinc-800" />
            ))}
          </div>
        ) : filteredPsvs.length > 0 ? (
          <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-700">
            <div className="hide-scrollbar overflow-x-auto border-b border-zinc-700">
              <table className="w-full min-w-[920px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[40%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/50 text-zinc-400">
                    <th className="px-4 py-3 text-left font-medium">
                      Verification Type
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Target</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Date Requested
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Notes</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
              </table>
            </div>
            <ScrollIndicatorContainer className="min-h-0 flex-1" viewportClassName="hide-scrollbar overflow-auto">
              <table className="w-full min-w-[920px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[40%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <tbody className="divide-y divide-zinc-800">
                {filteredPsvs.map((psv) =>
                  editingId === psv.id ? (
                    <tr key={psv.id} className="bg-zinc-900/40">
                      <td className="px-4 py-3 align-top">
                        <select
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          value={form.type}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              type: e.target.value as PendingPsv["type"],
                            }))
                          }
                        >
                          {PSV_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="space-y-2 px-4 py-3 align-top">
                        <Input
                          placeholder="e.g. Residency Program - Duke"
                          value={form.name}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, name: e.target.value }))
                          }
                        />
                        <Input
                          type="date"
                          value={form.nextFollowUp}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, nextFollowUp: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          value={form.status}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              status: e.target.value as Exclude<
                                PendingPsv["status"],
                                "Closed"
                              >,
                            }))
                          }
                        >
                          {PSV_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Input
                          type="date"
                          value={form.dateRequested}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, dateRequested: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Textarea
                          rows={2}
                          placeholder="Follow-up details, outcomes, blockers"
                          value={form.notes}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, notes: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={resetEditor}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={
                              isMutating || !form.name.trim() || !form.dateRequested
                            }
                            onClick={save}
                          >
                            Save
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={psv.id} className="hover:bg-zinc-900/50">
                      <td className="px-4 py-3 font-medium text-zinc-200">
                        {psv.type}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{psv.name}</td>
                      <td className="px-4 py-3 text-zinc-400">{psv.status}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {format(new Date(psv.dateRequested), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        <TruncatedTooltip
                          as="p"
                          text={psv.notes ?? "—"}
                          className="max-w-60"
                          tooltipClassName="max-w-sm whitespace-pre-wrap break-words"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => beginEdit(psv)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ),
                )}
                </tbody>
              </table>
            </ScrollIndicatorContainer>
          </div>
        ) : (
          <StandardEmptyState message="No matching PSV records found." />
        )}
      </div>
    </div>
  );
}

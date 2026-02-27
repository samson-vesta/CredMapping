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

type MissingDocStatus = "Completed" | "Pending Response" | "Not Completed";

type MissingDoc = {
  id: string;
  information: string | null;
  roadblocks: string | null;
  nextFollowUpUS: string | null;
  nextFollowUpIn: string | null;
  followUpStatus: MissingDocStatus | null;
};

interface MissingDocsManagerProps {
  relatedType: "provider" | "facility";
  relatedId: string;
  docs: MissingDoc[] | undefined;
  isLoading: boolean;
  onChanged: () => Promise<void> | void;
}

const defaultForm = {
  information: "",
  roadblocks: "",
  nextFollowUpUS: "",
  nextFollowUpIn: "",
  followUpStatus: "Not Completed" as MissingDocStatus,
};

export function MissingDocsManager({
  relatedType,
  relatedId,
  docs,
  isLoading,
  onChanged,
}: MissingDocsManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "completed" | "all"
  >("active");
  const [sortOrder, setSortOrder] = useState<"soonest" | "latest">("soonest");

  const createMutation = api.commLogs.createMissingDoc.useMutation();
  const updateMutation = api.commLogs.updateMissingDoc.useMutation();
  const isMutating = createMutation.isPending || updateMutation.isPending;
  const isCreating = isEditing && !editingId;

  const filteredDocs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = [...(docs ?? [])]
      .filter((doc) => {
        if (statusFilter === "all") return true;
        const isCompleted = doc.followUpStatus === "Completed";
        return statusFilter === "completed" ? isCompleted : !isCompleted;
      })
      .filter((doc) => {
        if (!query) return true;
        return [doc.information, doc.roadblocks, doc.followUpStatus]
          .filter((v): v is string => Boolean(v))
          .some((v) => v.toLowerCase().includes(query));
      });

    rows.sort((a, b) => {
      const valueA = [a.nextFollowUpUS, a.nextFollowUpIn]
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? "9999-12-31";
      const valueB = [b.nextFollowUpUS, b.nextFollowUpIn]
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? "9999-12-31";
      return sortOrder === "soonest"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });

    return rows;
  }, [docs, searchQuery, sortOrder, statusFilter]);

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

  const beginEdit = (doc: MissingDoc) => {
    setIsEditing(true);
    setEditingId(doc.id);
    setForm({
      information: doc.information ?? "",
      roadblocks: doc.roadblocks ?? "",
      nextFollowUpUS: doc.nextFollowUpUS ?? "",
      nextFollowUpIn: doc.nextFollowUpIn ?? "",
      followUpStatus: doc.followUpStatus ?? "Not Completed",
    });
  };

  const save = async () => {
    if (!form.information.trim()) return;

    const payload = {
      information: form.information,
      roadblocks: form.roadblocks || undefined,
      nextFollowUpUS: form.nextFollowUpUS || undefined,
      nextFollowUpIn: form.nextFollowUpIn || undefined,
      followUpStatus: form.followUpStatus,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMutation.mutateAsync({ relatedType, relatedId, ...payload });
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
            placeholder="Search missing docs..."
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
                    Missing Docs Filters and Sort
                  </SheetTitle>
                </SheetHeader>
                <div className="border-border space-y-4 border-t px-4 py-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as "active" | "completed" | "all",
                        )
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Archived</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Sort</label>
                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "soonest" | "latest")
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                    >
                      <option value="soonest">Next Follow-up (Soonest)</option>
                      <option value="latest">Next Follow-up (Latest)</option>
                    </select>
                  </div>
                </div>
                <SheetFooter className="px-4 py-4">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setStatusFilter("active");
                      setSortOrder("soonest");
                      setSearchQuery("");
                    }}
                  >
                    Reset filters
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Button size="sm" className="h-9" onClick={beginCreate}>
              + Add Missing Doc
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        {isCreating && (
          <div className="mb-4 grid gap-3 rounded-lg border border-zinc-700 bg-zinc-900/40 p-4 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Required Item</label>
              <Input
                placeholder="e.g. State License Copy"
                value={form.information}
                onChange={(e) =>
                  setForm((s) => ({ ...s, information: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">
                Next Follow-up Date (US)
              </label>
              <Input
                type="date"
                value={form.nextFollowUpUS}
                onChange={(e) =>
                  setForm((s) => ({ ...s, nextFollowUpUS: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">
                Next Follow-up Date (IN)
              </label>
              <Input
                type="date"
                value={form.nextFollowUpIn}
                onChange={(e) =>
                  setForm((s) => ({ ...s, nextFollowUpIn: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Record Status</label>
              <Input value="Not Completed" disabled />
            </div>
            <div className="space-y-1 md:col-span-4">
              <label className="text-xs text-zinc-400">Issue / Notes</label>
              <Textarea
                rows={3}
                placeholder="Describe what's missing and blockers"
                value={form.roadblocks}
                onChange={(e) =>
                  setForm((s) => ({ ...s, roadblocks: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 md:col-span-4">
              <Button variant="outline" onClick={resetEditor}>
                Cancel
              </Button>
              <Button
                disabled={isMutating || !form.information.trim()}
                onClick={save}
              >
                {editingId ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="h-12 w-full animate-pulse rounded bg-zinc-800" />
        ) : filteredDocs.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-700">
            <div className="hide-scrollbar overflow-x-auto border-b border-zinc-700">
              <table className="w-full min-w-[980px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[19%]" />
                  <col className="w-[31%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/50 text-zinc-400">
                    <th className="px-4 py-3 text-left font-medium">
                      Required Item
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Issue / Notes
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Next FU (US)
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Next FU (IN)
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
              </table>
            </div>
            <ScrollIndicatorContainer className="min-h-0 flex-1" viewportClassName="hide-scrollbar overflow-auto">
              <table className="w-full min-w-[980px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[19%]" />
                  <col className="w-[31%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <tbody className="divide-y divide-zinc-800">
                {filteredDocs.map((doc) =>
                  editingId === doc.id ? (
                    <tr key={doc.id} className="bg-zinc-900/40">
                      <td className="px-4 py-3 align-top">
                        <Input
                          placeholder="e.g. State License Copy"
                          value={form.information}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, information: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Textarea
                          rows={2}
                          placeholder="Describe what's missing and blockers"
                          value={form.roadblocks}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, roadblocks: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={form.followUpStatus}
                          onChange={(e) =>
                            setForm((state) => ({
                              ...state,
                              followUpStatus: e.target.value as MissingDocStatus,
                            }))
                          }
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                        >
                          <option value="Not Completed">Not Completed</option>
                          <option value="Pending Response">Pending Response</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Input
                          type="date"
                          value={form.nextFollowUpUS}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, nextFollowUpUS: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Input
                          type="date"
                          value={form.nextFollowUpIn}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, nextFollowUpIn: e.target.value }))
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
                            disabled={isMutating || !form.information.trim()}
                            onClick={save}
                          >
                            Save
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={doc.id} className="hover:bg-zinc-900/50">
                      <td className="px-4 py-3 font-medium text-zinc-200">
                        {doc.information}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 italic">
                        <TruncatedTooltip
                          as="p"
                          text={doc.roadblocks ?? "—"}
                          className="max-w-full"
                          tooltipClassName="max-w-sm whitespace-pre-wrap break-words"
                        />
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {doc.followUpStatus ?? "Not Completed"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {doc.nextFollowUpUS
                          ? format(new Date(doc.nextFollowUpUS), "MMM d, yyyy")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {doc.nextFollowUpIn
                          ? format(new Date(doc.nextFollowUpIn), "MMM d, yyyy")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => beginEdit(doc)}
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
          <StandardEmptyState message="No matching missing documentation found." />
        )}
      </div>
    </div>
  );
}

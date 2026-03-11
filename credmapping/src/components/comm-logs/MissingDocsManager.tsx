"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { SlidersHorizontal } from "lucide-react";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(query));
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
    setExpandedId(doc.id);
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

  const toggleExpanded = (docId: string) => {
    setExpandedId((current) => (current === docId ? null : docId));
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
                    <label className="text-xs text-muted-foreground">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as "active" | "completed" | "all",
                        )
                      }
                      className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm text-foreground"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Archived</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Sort</label>
                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "soonest" | "latest")
                      }
                      className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm text-foreground"
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
          <div className="mb-4 grid gap-3 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Information</label>
              <Textarea
                rows={3}
                className="resize-y"
                placeholder="e.g. State License Copy"
                value={form.information}
                onChange={(e) =>
                  setForm((state) => ({ ...state, information: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Next Follow-up Date (US)
              </label>
              <Input
                type="date"
                value={form.nextFollowUpUS}
                onChange={(e) =>
                  setForm((state) => ({ ...state, nextFollowUpUS: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Next Follow-up Date (IN)
              </label>
              <Input
                type="date"
                value={form.nextFollowUpIn}
                onChange={(e) =>
                  setForm((state) => ({ ...state, nextFollowUpIn: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Record Status</label>
              <Input value="Not Completed" disabled />
            </div>
            <div className="space-y-1 md:col-span-4">
              <label className="text-xs text-muted-foreground">Roadblocks</label>
              <Textarea
                rows={3}
                placeholder="Describe missing details and blockers"
                value={form.roadblocks}
                onChange={(e) =>
                  setForm((state) => ({ ...state, roadblocks: e.target.value }))
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
          <div className="h-12 w-full animate-pulse rounded bg-muted" />
        ) : filteredDocs.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <ScrollIndicatorContainer
              className="min-h-0 flex-1"
              viewportClassName="hide-scrollbar overflow-auto"
            >
              <table className="w-full min-w-[1120px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[28%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Information
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Roadblocks
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
                <tbody className="divide-y divide-border">
                  {filteredDocs.map((doc) =>
                    editingId === doc.id ? (
                      <tr key={doc.id} className="bg-muted/20">
                        <td className="min-w-0 px-4 py-3 align-top">
                          <Textarea
                            rows={2}
                            className="min-w-0 resize-y"
                            placeholder="e.g. State License Copy"
                            value={form.information}
                            onChange={(e) =>
                              setForm((state) => ({
                                ...state,
                                information: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="min-w-0 px-4 py-3 align-top">
                          <Textarea
                            className="min-w-0 resize-y"
                            rows={2}
                            placeholder="Describe missing details and blockers"
                            value={form.roadblocks}
                            onChange={(e) =>
                              setForm((state) => ({
                                ...state,
                                roadblocks: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="min-w-0 px-4 py-3 align-top">
                          <select
                            value={form.followUpStatus}
                            onChange={(e) =>
                              setForm((state) => ({
                                ...state,
                                followUpStatus: e.target.value as MissingDocStatus,
                              }))
                            }
                            className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm text-foreground"
                          >
                            <option value="Not Completed">Not Completed</option>
                            <option value="Pending Response">
                              Pending Response
                            </option>
                            <option value="Completed">Completed</option>
                          </select>
                        </td>
                        <td className="min-w-0 px-4 py-3 align-top">
                          <Input
                            className="min-w-0"
                            type="date"
                            value={form.nextFollowUpUS}
                            onChange={(e) =>
                              setForm((state) => ({
                                ...state,
                                nextFollowUpUS: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="min-w-0 px-4 py-3 align-top">
                          <Input
                            className="min-w-0"
                            type="date"
                            value={form.nextFollowUpIn}
                            onChange={(e) =>
                              setForm((state) => ({
                                ...state,
                                nextFollowUpIn: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="min-w-0 px-4 py-3 align-top">
                          <div className="flex min-w-0 flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full whitespace-nowrap"
                              onClick={resetEditor}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="w-full whitespace-nowrap"
                              disabled={isMutating || !form.information.trim()}
                              onClick={save}
                            >
                              Save
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={doc.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => toggleExpanded(doc.id)}
                        aria-expanded={expandedId === doc.id}
                      >
                        <td className="min-w-0 px-4 py-3 font-medium text-foreground">
                          {expandedId === doc.id ? (
                            <p className="whitespace-pre-wrap break-words">
                              {doc.information ?? "-"}
                            </p>
                          ) : (
                            <TruncatedTooltip
                              as="p"
                              text={doc.information ?? "-"}
                              className="max-w-full"
                              tooltipClassName="max-w-sm whitespace-pre-wrap break-words"
                            />
                          )}
                        </td>
                        <td className="min-w-0 px-4 py-3 text-muted-foreground italic">
                          {expandedId === doc.id ? (
                            <p className="whitespace-pre-wrap break-words">
                              {doc.roadblocks ?? "-"}
                            </p>
                          ) : (
                            <TruncatedTooltip
                              as="p"
                              text={doc.roadblocks ?? "-"}
                              className="max-w-full"
                              tooltipClassName="max-w-sm whitespace-pre-wrap break-words"
                            />
                          )}
                        </td>
                        <td className="min-w-0 px-4 py-3 text-muted-foreground">
                          <p
                            className={
                              expandedId === doc.id
                                ? "whitespace-pre-wrap break-words"
                                : "truncate"
                            }
                          >
                            {doc.followUpStatus ?? "Not Completed"}
                          </p>
                        </td>
                        <td className="min-w-0 px-4 py-3 text-muted-foreground">
                          <p className="truncate whitespace-nowrap">
                            {doc.nextFollowUpUS
                              ? format(new Date(doc.nextFollowUpUS), "MMM d, yyyy")
                              : "-"}
                          </p>
                        </td>
                        <td className="min-w-0 px-4 py-3 text-muted-foreground">
                          <p className="truncate whitespace-nowrap">
                            {doc.nextFollowUpIn
                              ? format(new Date(doc.nextFollowUpIn), "MMM d, yyyy")
                              : "-"}
                          </p>
                        </td>
                        <td className="min-w-0 px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap"
                            onClick={(event) => {
                              event.stopPropagation();
                              beginEdit(doc);
                            }}
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

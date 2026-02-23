"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { SlidersHorizontal } from "lucide-react";
import { CommLogFeed } from "./CommLogFeed";
import { NewLogModal } from "./NewLogModal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { api } from "~/trpc/react";

interface ProviderDetailProps {
  providerId: string;
  provider: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    degree: string | null;
    email: string | null;
    notes: string | null;
  };
}

export function ProviderDetail({ providerId, provider }: ProviderDetailProps) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<"logs" | "psv" | "notes">("logs");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<{
    id: string;
    commType: string | null;
    subject: string | null;
    notes: string | null;
    status: string | null;
    nextFollowupAt: Date | string | null;
  } | null>(null);
  const [selectedCommType, setSelectedCommType] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: authUser } = api.auth.me.useQuery();
  const canCreateLog =
    authUser?.role === "admin" || authUser?.role === "superadmin";

  const { data: logs, isLoading: logsLoading } =
    api.commLogs.listByProvider.useQuery({ providerId });

  const { data: summary } = api.commLogs.getProviderSummary.useQuery({
    providerId,
  });

  const { data: pendingPSVs, isLoading: psvLoading } =
    api.commLogs.getPendingPSVsByProvider.useQuery({ providerId });

  const uniqueAgents = useMemo(() => {
    if (!logs) return [];
    return Array.from(
      new Set(
        logs
          .map((log) => log.agentName)
          .filter((name): name is string => name != null),
      ),
    ).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];

    const result = logs
      .filter(
        (log) =>
          selectedCommType === "all" || log.commType === selectedCommType,
      )
      .filter(
        (log) => selectedAgent === "all" || log.agentName === selectedAgent,
      )
      .filter(
        (log) => selectedStatus === "all" || log.status === selectedStatus,
      )
      .filter((log) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return [log.subject, log.notes, log.commType, log.createdByName]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(query));
      });

    if (sortOrder === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime(),
      );
    }

    return result;
  }, [
    logs,
    searchQuery,
    selectedCommType,
    selectedAgent,
    selectedStatus,
    sortOrder,
  ]);

  const fullName = [provider.firstName, provider.lastName]
    .filter(Boolean)
    .join(" ");

  const handleLogCreated = async () => {
    await Promise.all([
      utils.commLogs.listByProvider.invalidate({ providerId }),
      utils.commLogs.getProviderSummary.invalidate({ providerId }),
      utils.commLogs.getPendingPSVsByProvider.invalidate({ providerId }),
      utils.providersWithCommLogs.listWithCommLogStatus.invalidate(),
    ]);
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header Card */}
      <div className="border-border bg-card border-b p-6">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 truncate text-2xl font-bold text-white">
              {fullName}
            </h2>
            <span className="border-border bg-secondary text-secondary-foreground rounded border px-2 py-1 text-xs font-medium">
              {provider.degree ?? "—"}
            </span>
          </div>
          {provider.email && (
            <p className="text-sm text-zinc-400">{provider.email}</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <p className="mb-1 text-zinc-400">Next Follow-Up</p>
            <p className="font-medium text-white">
              {summary?.nextFollowupAt
                ? format(new Date(summary.nextFollowupAt), "MMM d, yyyy")
                : "—"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Last Followed Up</p>
            <p className="font-medium text-white">
              {summary?.latestFollowupAt
                ? format(new Date(summary.latestFollowupAt), "MMM d, yyyy")
                : "—"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Total Logs</p>
            <p className="font-medium text-white">{summary?.totalLogs ?? 0}</p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Open Tasks</p>
            <p className="font-medium text-white">
              {summary?.openTasksCount ?? 0}
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Status</p>
            <p className="font-medium text-white">Active</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-border bg-card flex gap-4 border-b px-6">
        {[
          { id: "logs", label: "Comm Log" },
          { id: "psv", label: "Pending PSVs / Missing Docs" },
          { id: "notes", label: "Notes & Profile" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-primary text-white"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {activeTab === "logs" && (
          <div>
            <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 mb-4 border-b pt-1 pb-4 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-9 min-w-[240px] flex-1"
                  placeholder="Search communication logs"
                />

                <div className="ml-auto flex items-center gap-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="h-9">
                        <SlidersHorizontal className="size-4" />
                        Filters
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Comm log filters</SheetTitle>
                        <SheetDescription>
                          Filter and sort communication logs.
                        </SheetDescription>
                      </SheetHeader>

                      <div className="space-y-4 px-4">
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Type</label>
                          <select
                            value={selectedCommType}
                            onChange={(e) =>
                              setSelectedCommType(e.target.value)
                            }
                            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          >
                            <option value="all">All Types</option>
                            <option value="Email">Email</option>
                            <option value="Phone Call">Phone Call</option>
                            <option value="Dropbox">Dropbox</option>
                            <option value="Document">Document</option>
                            <option value="Modio">Modio</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Agent</label>
                          <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          >
                            <option value="all">All Agents</option>
                            {uniqueAgents.map((agent) => (
                              <option key={agent} value={agent}>
                                {agent}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">
                            Status
                          </label>
                          <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          >
                            <option value="all">All Status</option>
                            <option value="pending_response">
                              Pending Response
                            </option>
                            <option value="fu_completed">F/U Completed</option>
                            <option value="received">Received</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Sort</label>
                          <select
                            value={sortOrder}
                            onChange={(e) =>
                              setSortOrder(
                                e.target.value as "newest" | "oldest",
                              )
                            }
                            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                          </select>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setSelectedCommType("all");
                            setSelectedAgent("all");
                            setSelectedStatus("all");
                            setSortOrder("newest");
                          }}
                        >
                          Reset filters
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {canCreateLog && (
                    <Button
                      className="h-9"
                      onClick={() => {
                        setEditingLog(null);
                        setIsModalOpen(true);
                      }}
                    >
                      + Add Comm Log
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <CommLogFeed
              logs={
                filteredLogs?.map((log) => ({
                  id: log.id,
                  commType: log.commType,
                  subject: log.subject,
                  notes: log.notes,
                  status: log.status,
                  createdAt: log.createdAt,
                  nextFollowupAt: log.nextFollowupAt,
                  createdByName: log.createdByName,
                  lastUpdatedByName: log.lastUpdatedByName,
                })) || []
              }
              isLoading={logsLoading}
              onNewLog={() => {
                setEditingLog(null);
                setIsModalOpen(true);
              }}
              onSelectLog={(log) => {
                setEditingLog(log);
                setIsModalOpen(true);
              }}
            />
          </div>
        )}

        {activeTab === "psv" && (
          <div>
            {psvLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card h-12 animate-pulse rounded" />
                ))}
              </div>
            ) : pendingPSVs && pendingPSVs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-zinc-400">
                      <th className="px-4 py-3 text-left font-medium">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Facility + Privileges
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {pendingPSVs.map((psv) => (
                      <tr key={psv.id} className="hover:bg-zinc-900/50">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                              psv.decision === "pending"
                                ? "bg-yellow-500/15 text-yellow-400"
                                : psv.decision === "approved"
                                  ? "bg-green-500/15 text-green-400"
                                  : "bg-zinc-700 text-zinc-400"
                            }`}
                          >
                            ●{" "}
                            {psv.decision === "pending"
                              ? "Pending"
                              : psv.decision === "approved"
                                ? "Approved"
                                : "Closed"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {psv.facilityType}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-zinc-300">
                            <div className="font-medium">
                              {psv.facilityName}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {psv.privileges}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              psv.priority === "high"
                                ? "text-red-400"
                                : psv.priority === "normal"
                                  ? "text-zinc-400"
                                  : "text-zinc-500"
                            }
                          >
                            {psv.priority}
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-zinc-400">
                          {psv.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-zinc-400">No pending PSVs</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">
                Provider Notes
              </h3>
              {provider.notes ? (
                <div className="bg-card rounded-lg border border-zinc-700 p-4 text-zinc-300">
                  {provider.notes}
                </div>
              ) : (
                <p className="text-zinc-400">No notes on file</p>
              )}
            </div>
          </div>
        )}
      </div>

      <NewLogModal
        isOpen={isModalOpen}
        editingLog={editingLog}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLog(null);
        }}
        relatedId={providerId}
        relatedType="provider"
        onLogCreated={handleLogCreated}
      />
    </div>
  );
}

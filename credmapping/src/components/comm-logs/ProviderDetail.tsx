"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CommLogFeed } from "./CommLogFeed";
import { NewLogModal } from "./NewLogModal";
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
  const [activeTab, setActiveTab] = useState<"logs" | "psv" | "notes">("logs");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCommType, setSelectedCommType] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

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
          .filter((name): name is string => name != null)
      )
    ).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];

    const result = logs
      .filter(
        (log) => selectedCommType === "all" || log.commType === selectedCommType
      )
      .filter(
        (log) => selectedAgent === "all" || log.agentName === selectedAgent
      )
      .filter(
        (log) => selectedStatus === "all" || log.status === selectedStatus
      );

    if (sortOrder === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime()
      );
    }

    return result;
  }, [logs, selectedCommType, selectedAgent, selectedStatus, sortOrder]);

  const fullName = [provider.firstName, provider.lastName]
    .filter(Boolean)
    .join(" ");

  const displayName = provider.degree ? `${fullName}, ${provider.degree}` : fullName;

  const handleLogCreated = () => {
    // Refetch logs
    window.location.reload();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Header Card */}
      <div className="border-b border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-2">{displayName}</h2>
          {provider.email && (
            <p className="text-sm text-zinc-400">{provider.email}</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-zinc-400 mb-1">Next Follow-Up</p>
            <p className="text-white font-medium">
              {summary?.nextFollowupAt
                ? format(new Date(summary.nextFollowupAt), "MMM d, yyyy")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-zinc-400 mb-1">Last Followed Up</p>
            <p className="text-white font-medium">
              {summary?.latestFollowupAt
                ? format(new Date(summary.latestFollowupAt), "MMM d, yyyy")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-zinc-400 mb-1">Total Logs</p>
            <p className="text-white font-medium">{summary?.totalLogs ?? 0}</p>
          </div>
          <div>
            <p className="text-zinc-400 mb-1">Open Tasks</p>
            <p className="text-white font-medium">
              {summary?.openTasksCount ?? 0}
            </p>
          </div>
          <div>
            <p className="text-zinc-400 mb-1">Status</p>
            <p className="text-white font-medium">Active</p>
          </div>
        </div>


      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border bg-card px-6">
        {[
          { id: "logs", label: "Comm Log" },
          { id: "psv", label: "Pending PSVs / Missing Docs" },
          { id: "notes", label: "Notes & Profile" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
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
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "logs" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Communication History
              </h3>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition-colors"
              >
                + New Log Entry
              </button>
            </div>

            {/* Filter Bar */}
            <div className="mb-4 flex items-center gap-2 px-4 py-3 border border-zinc-800 bg-zinc-900/50 rounded-lg">
              <div className="flex items-center gap-1">
                <label className="text-xs text-zinc-500 mr-1">Type:</label>
                <select
                  value={selectedCommType}
                  onChange={(e) => setSelectedCommType(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:border-ring"
                >
                  <option value="all">All Types</option>
                  <option value="Email">Email</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Dropbox">Dropbox</option>
                  <option value="Document">Document</option>
                  <option value="Modio">Modio</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <label className="text-xs text-zinc-500 mr-1">Agent:</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:border-ring"
                >
                  <option value="all">All Agents</option>
                  {uniqueAgents.map((agent) => (
                    <option key={agent} value={agent}>
                      {agent}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <label className="text-xs text-zinc-500 mr-1">Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:border-ring"
                >
                  <option value="all">All Status</option>
                  <option value="pending_response">Pending Response</option>
                  <option value="fu_completed">F/U Completed</option>
                  <option value="received">Received</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <label className="text-xs text-zinc-500 mr-1">Sort:</label>
                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as "newest" | "oldest")
                  }
                  className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:border-ring"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
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
                  agentName: log.agentName,
                  createdByName: log.createdByName,
                  lastUpdatedByName: log.lastUpdatedByName,
                })) || []
              }
              isLoading={logsLoading}
              onNewLog={() => setIsModalOpen(true)}
            />
          </div>
        )}

        {activeTab === "psv" && (
          <div>
            {psvLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-card rounded animate-pulse"
                  />
                ))}
              </div>
            ) : pendingPSVs && pendingPSVs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-zinc-400">
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">
                        Facility + Privileges
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Priority
                      </th>
                      <th className="text-left px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {pendingPSVs.map((psv) => (
                      <tr key={psv.id} className="hover:bg-zinc-900/50">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              psv.decision === "pending"
                                ? "bg-yellow-500/15 text-yellow-400"
                                : psv.decision === "approved"
                                  ? "bg-green-500/15 text-green-400"
                                  : "bg-zinc-700 text-zinc-400"
                            }`}
                          >
                            ● {psv.decision === "pending" ? "Pending" : psv.decision === "approved" ? "Approved" : "Closed"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {psv.facilityType}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-zinc-300">
                            <div className="font-medium">{psv.facilityName}</div>
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
                        <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                          {psv.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-400">No pending PSVs</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Provider Notes
              </h3>
              {provider.notes ? (
                <div className="p-4 bg-card rounded-lg border border-zinc-700 text-zinc-300">
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
        onClose={() => setIsModalOpen(false)}
        relatedId={providerId}
        relatedType="provider"
        onLogCreated={handleLogCreated}
      />
    </div>
  );
}

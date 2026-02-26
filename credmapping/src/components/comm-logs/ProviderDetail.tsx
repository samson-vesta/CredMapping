"use client";

import { useState, useMemo } from "react";
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
import { MissingDocsManager } from "./MissingDocsManager";
import { PendingPsvManager } from "./PendingPsvManager";
import { api } from "~/trpc/react";

interface ProviderDetailProps {
  providerId: string;
  provider: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    degree: string | null;
    email: string | null;
    privilegeTier: string | null;
  };
}

export function ProviderDetail({ providerId, provider }: ProviderDetailProps) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<"logs" | "missing-docs" | "psv">("logs");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<{
    id: string;
    commType: string | null;
    subject: string | null;
    notes: string | null;
  } | null>(null);

  const [selectedCommType, setSelectedCommType] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: authUser } = api.auth.me.useQuery();
  const canCreateLog =
    authUser?.role === "admin" || authUser?.role === "superadmin";

  const { data: logs, isLoading: logsLoading } =
    api.commLogs.listByProvider.useQuery({ providerId });
  const { data: summary } = api.commLogs.getSummary.useQuery({
    relatedId: providerId,
    relatedType: "provider",
  });
  const { data: missingDocs, isLoading: docsLoading } =
    api.commLogs.getMissingDocs.useQuery({
      relatedId: providerId,
      relatedType: "provider",
    });
  const { data: pendingPSVs, isLoading: psvLoading } =
    api.commLogs.getPendingPSVs.useQuery({ providerId });

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
      .filter((log) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return [log.subject, log.notes, log.commType, log.createdByName]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(query));
      });

    result.sort((a, b) => {
      const timeA = new Date(a.createdAt ?? 0).getTime();
      const timeB = new Date(b.createdAt ?? 0).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [logs, searchQuery, selectedCommType, selectedAgent, sortOrder]);

  const fullName = [provider.lastName, provider.firstName]
    .filter(Boolean)
    .join(", ");

  const handleLogCreated = async () => {
    await Promise.all([
      utils.commLogs.listByProvider.invalidate({ providerId }),
      utils.commLogs.getSummary.invalidate({ relatedId: providerId }),
      utils.commLogs.getMissingDocs.invalidate({ relatedId: providerId }),
      utils.commLogs.getPendingPSVs.invalidate({ providerId }),
      utils.providersWithCommLogs.listWithCommLogStatus.invalidate(),
    ]);
  };

  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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
          <p className="text-sm text-zinc-400">
            {provider.email ?? "No provider email listed"}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="mb-1 text-zinc-400">Total Activity</p>
            <p className="font-medium text-white">
              {summary?.totalLogs ?? 0} Logs
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Missing Docs</p>
            <p
              className={`font-medium ${summary?.activeRoadblocks ? "text-rose-400" : "text-emerald-400"}`}
            >
              {summary?.activeRoadblocks ?? 0} Item(s)
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">PSV Progress</p>
            <p className="font-medium text-white">
              {pendingPSVs?.length ?? 0} Tasks
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Vesta Privileges Tier</p>
            <p className="font-medium text-white">{provider.privilegeTier ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-border bg-card flex gap-4 border-b px-6">
        {[
          { id: "logs", label: "Logs" },
          { id: "missing-docs", label: "Missing Docs" },
          { id: "psv", label: "PSV" },
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

      {/* Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "logs" && (
          <div>
            <div className="border-border bg-card sticky top-0 z-10 border-b px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-9 min-w-60 flex-1"
                  placeholder="Search activity diary..."
                />
                <div className="ml-auto flex items-center gap-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="h-9">
                        <SlidersHorizontal className="size-4" /> Filters
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Activity Filters</SheetTitle>
                        <SheetDescription>
                          Filter the interaction diary.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="space-y-4 px-4 py-4">
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">
                            Method
                          </label>
                          <select
                            value={selectedCommType}
                            onChange={(e) =>
                              setSelectedCommType(e.target.value)
                            }
                            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          >
                            <option value="all">All Methods</option>
                            <option value="Email">Email</option>
                            <option value="Phone Call">Phone Call</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">
                            Team Member
                          </label>
                          <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300"
                          >
                            <option value="all">All Members</option>
                            {uniqueAgents.map((agent) => (
                              <option key={agent} value={agent}>
                                {agent}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-xs">
                            Sort Order
                          </label>
                          <select
                            value={sortOrder}
                            onChange={(e) =>
                              setSortOrder(
                                e.target.value as "newest" | "oldest",
                              )
                            }
                            className="bg-background w-full rounded border p-2 text-sm"
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
                            setSearchQuery("");
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
                      + Log Interaction
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4">
              <CommLogFeed
                logs={filteredLogs.map((log) => ({
                  id: log.id,
                  commType: log.commType,
                  subject: log.subject,
                  notes: log.notes,
                  createdAt: log.createdAt,
                  createdByName: log.createdByName,
                  lastUpdatedByName: log.lastUpdatedByName,
                }))}
                isLoading={logsLoading}
                onSelectLog={(log) => {
                  setEditingLog(log);
                  setIsModalOpen(true);
                }}
              />
            </div>
          </div>
        )}

        {activeTab === "missing-docs" && (
          <MissingDocsManager
            relatedType="provider"
            relatedId={providerId}
            docs={missingDocs}
            isLoading={docsLoading}
            onChanged={handleLogCreated}
          />
        )}

        {activeTab === "psv" && (
          <PendingPsvManager
            providerId={providerId}
            psvs={pendingPSVs}
            isLoading={psvLoading}
            onChanged={handleLogCreated}
          />
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

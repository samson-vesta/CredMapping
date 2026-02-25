"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { SlidersHorizontal } from "lucide-react";
import { CommLogFeed } from "./CommLogFeed";
import { NewLogModal } from "./NewLogModal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
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
  } | null>(null);
  
  const [selectedCommType, setSelectedCommType] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: authUser } = api.auth.me.useQuery();
  const canCreateLog = authUser?.role === "admin" || authUser?.role === "superadmin";

  const { data: logs, isLoading: logsLoading } = api.commLogs.listByProvider.useQuery({ providerId });
  const { data: summary } = api.commLogs.getSummary.useQuery({ relatedId: providerId, relatedType: "provider" });
  const { data: missingDocs, isLoading: docsLoading } = api.commLogs.getMissingDocs.useQuery({
      relatedId: providerId,
      relatedType: "provider",
    });
  const { data: pendingPSVs, isLoading: psvLoading } = api.commLogs.getPendingPSVs.useQuery({ providerId });

  const uniqueAgents = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map((log) => log.agentName).filter((name): name is string => name != null))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const result = logs
      .filter((log) => selectedCommType === "all" || log.commType === selectedCommType)
      .filter((log) => selectedAgent === "all" || log.agentName === selectedAgent)
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

  const fullName = [provider.firstName, provider.lastName].filter(Boolean).join(" ");

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
    <div className="bg-background flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header Card */}
      <div className="border-border bg-card border-b p-6">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 truncate text-2xl font-bold text-white">{fullName}</h2>
            <span className="border-border bg-secondary text-secondary-foreground rounded border px-2 py-1 text-xs font-medium">
              {provider.degree ?? "—"}
            </span>
          </div>
          {provider.email && <p className="text-sm text-zinc-400">{provider.email}</p>}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="mb-1 text-zinc-400">Total Activity</p>
            <p className="font-medium text-white">{summary?.totalLogs ?? 0} Logs</p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Missing Docs</p>
            <p className={`font-medium ${summary?.activeRoadblocks ? 'text-rose-400' : 'text-emerald-400'}`}>
              {summary?.activeRoadblocks ?? 0} Item(s)
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">PSV Progress</p>
            <p className="font-medium text-white">{pendingPSVs?.length ?? 0} Tasks</p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Database Entry</p>
            <p className="font-medium text-white">Verified</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-border bg-card flex gap-4 border-b px-6">
        {[
          { id: "logs", label: "Logs" },
          { id: "psv", label: "Missing Docs & PSV" },
          { id: "notes", label: "Provider Notes" },
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
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {activeTab === "logs" && (
          <div>
            <div className="border-border bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-10 mb-4 border-b pt-1 pb-4 backdrop-blur">
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
                        <SheetDescription>Filter the interaction diary.</SheetDescription>
                      </SheetHeader>
                      <div className="space-y-4 px-4 py-4">
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Method</label>
                          <select value={selectedCommType} onChange={(e) => setSelectedCommType(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300">
                            <option value="all">All Methods</option>
                            <option value="Email">Email</option>
                            <option value="Phone Call">Phone Call</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Team Member</label>
                          <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-300">
                            <option value="all">All Members</option>
                            {uniqueAgents.map((agent) => <option key={agent} value={agent}>{agent}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Sort Order</label>
                          <select 
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")} 
                            className="w-full rounded border bg-background p-2 text-sm"
                          >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                          </select>
                        </div>
                        <Button variant="outline" className="w-full" onClick={() => { setSelectedCommType("all"); setSelectedAgent("all"); setSearchQuery(""); }}>Reset filters</Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                  {canCreateLog && <Button className="h-9" onClick={() => { setEditingLog(null); setIsModalOpen(true); }}>+ Log Interaction</Button>}
                </div>
              </div>
            </div>

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
              onNewLog={() => { setEditingLog(null); setIsModalOpen(true); }}
              onSelectLog={(log) => { setEditingLog(log); setIsModalOpen(true); }}
            />
          </div>
        )}

        {activeTab === "psv" && (
          <div className="space-y-8">
            {/* Missing Docs Section */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-rose-400">Active Missing Docs</h3>
              {docsLoading ? (
                <div className="h-12 w-full animate-pulse rounded bg-zinc-800" />
              ) : missingDocs && missingDocs.length > 0 ? (
                <div className="space-y-3">
                  {missingDocs.map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-white">{doc.information}</p>
                        <Badge variant="outline" className="text-rose-400 border-rose-400/30 text-[10px]">Action Required</Badge>
                      </div>
                      <p className="text-sm text-zinc-400 italic">Document Issue: {doc.roadblocks ?? "N/A"}</p>
                      <p className="mt-2 text-xs text-zinc-500">Next Follow-up: {doc.nextFollowUp ? format(new Date(doc.nextFollowUp), "MMM d, yyyy") : "TBD"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 italic">No missing documentation found.</p>
              )}
            </div>

            {/* PSV Checklist Section */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-blue-400">PSV Checklist</h3>
              {psvLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-zinc-800" />)}
                </div>
              ) : pendingPSVs && pendingPSVs.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-zinc-700 bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-700 bg-muted/50 text-zinc-400">
                        <th className="px-4 py-3 text-left font-medium">Verification Type</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Requested</th>
                        <th className="px-4 py-3 text-left font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {pendingPSVs.map((psv) => (
                        <tr key={psv.id} className="hover:bg-zinc-900/50">
                          <td className="px-4 py-3 font-medium text-zinc-200">{psv.type}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{psv.status}</Badge></td>
                          <td className="px-4 py-3 text-zinc-400">{format(new Date(psv.dateRequested), "MMM d, yyyy")}</td>
                          <td className="px-4 py-3 text-zinc-500 truncate max-w-50">{psv.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 italic">No verifications in progress.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Internal Notes</h3>
            {provider.notes ? (
              <div className="bg-card rounded-lg border border-zinc-700 p-4 text-zinc-300 leading-relaxed">
                {provider.notes}
              </div>
            ) : (
              <p className="text-zinc-400 italic">No internal provider notes on file.</p>
            )}
          </div>
        )}
      </div>

      <NewLogModal
        isOpen={isModalOpen}
        editingLog={editingLog}
        onClose={() => { setIsModalOpen(false); setEditingLog(null); }}
        relatedId={providerId}
        relatedType="provider"
        onLogCreated={handleLogCreated}
      />
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { SlidersHorizontal, Info } from "lucide-react";
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
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface FacilityDetailProps {
  facilityId: string;
  facility: {
    id: string;
    name: string | null;
    state: string | null;
    status: string | null;
    address: string | null;
    email: string | null;
  };
}

export function FacilityDetail({ facilityId, facility }: FacilityDetailProps) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<"logs" | "missing-docs" | "contacts">("logs");
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

  const { data: logs, isLoading: logsLoading } = api.commLogs.listByFacility.useQuery({ facilityId });
  const { data: summary } = api.commLogs.getSummary.useQuery({ relatedId: facilityId, relatedType: "facility" });
  const { data: missingDocs, isLoading: docsLoading } = api.commLogs.getMissingDocs.useQuery({ relatedId: facilityId, relatedType: "facility" });
  const { data: contactData } = api.commLogs.getContactsAndFacilityInfo.useQuery({ facilityId });

  const uniqueAgents = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map((l) => l.agentName).filter((n): n is string => n != null))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const result = logs
      .filter((l) => selectedCommType === "all" || l.commType === selectedCommType)
      .filter((l) => selectedAgent === "all" || l.agentName === selectedAgent)
      .filter((l) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return [l.subject, l.notes, l.commType, l.agentName].some(v => v?.toLowerCase().includes(q));
      });

    result.sort((a, b) => {
      const timeA = new Date(a.createdAt ?? 0).getTime();
      const timeB = new Date(b.createdAt ?? 0).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [logs, searchQuery, selectedCommType, selectedAgent, sortOrder]);

  const handleLogCreated = async () => {
    await Promise.all([
      utils.commLogs.listByFacility.invalidate({ facilityId }),
      utils.commLogs.getSummary.invalidate({ relatedId: facilityId }),
      utils.commLogs.getMissingDocs.invalidate({ relatedId: facilityId }),
      utils.commLogs.getContactsAndFacilityInfo.invalidate({ facilityId }),
      utils.facilitiesWithCommLogs.listWithCommLogStatus.invalidate(),
    ]);
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border bg-card border-b p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="truncate text-2xl font-bold text-white">{facility.name}</h2>
              <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground uppercase font-mono">
                {facility.state ?? "N/A"}
              </Badge>
            </div>
            <p className="text-sm text-zinc-400">{facility.email ?? "No facility email listed"}</p>
          </div>
          <Badge className={facility.status === "Active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}>
            {facility.status ?? "Unknown"}
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="mb-1 text-zinc-400">Missing Docs</p>
            <p className={`font-medium ${summary?.activeRoadblocks ? 'text-rose-400' : 'text-white'}`}>
              {summary?.activeRoadblocks ?? 0}
            </p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Total Logs</p>
            <p className="font-medium text-white">{summary?.totalLogs ?? 0}</p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">Proxy Entity</p>
            <p className="font-medium text-white truncate">{contactData?.facilityInfo?.proxy ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-zinc-400">TAT / SLA</p>
            <p className="font-medium text-white">{contactData?.facilityInfo?.tatSla ?? "Standard"}</p>
          </div>
        </div>
      </div>

      <div className="border-border bg-card flex gap-4 border-b px-6">
        {[
          { id: "logs", label: "Comm Log" },
          { id: "missing-docs", label: "Missing Docs" },
          { id: "contacts", label: "Contact Info & Notes" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "logs" | "missing-docs" | "contacts")}
            className={`border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
              activeTab === tab.id ? "border-primary text-white" : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {activeTab === "logs" && (
          <div>
            <div className="flex items-center gap-2 mb-4 sticky top-0 bg-background pt-1 pb-4 border-b border-border">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 flex-1"
                placeholder="Search communication logs"
              />
              
              {/* Sheet Filter Menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2">
                    <SlidersHorizontal className="h-4 w-4" /> Filters
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filter Logs</SheetTitle>
                    <SheetDescription>Narrow down the activity history.</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 py-4 px-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Log Type</label>
                      <select value={selectedCommType} onChange={(e) => setSelectedCommType(e.target.value)} className="w-full rounded border bg-background p-2 text-sm">
                        <option value="all">All Types</option>
                        <option value="Email">Email</option>
                        <option value="Phone Call">Phone Call</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Team Member</label>
                      <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="w-full rounded border bg-background p-2 text-sm">
                        <option value="all">All Members</option>
                        {uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}
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
                    <Button variant="ghost" className="w-full text-xs" onClick={() => { setSelectedCommType("all"); setSelectedAgent("all"); setSearchQuery(""); }}>Reset</Button>
                  </div>
                </SheetContent>
              </Sheet>

              {canCreateLog && <Button onClick={() => { setEditingLog(null); setIsModalOpen(true); }} className="h-9">+ Add Comm Log</Button>}
            </div>
            <CommLogFeed 
              logs={filteredLogs} 
              isLoading={logsLoading} 
              onNewLog={() => setIsModalOpen(true)} 
              onSelectLog={(log) => { setEditingLog(log); setIsModalOpen(true); }} 
            />
          </div>
        )}

        {activeTab === "missing-docs" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-rose-400">Active Missing Documentation</h3>
            {docsLoading ? (
              <div className="h-12 w-full animate-pulse rounded bg-zinc-800" />
            ) : missingDocs && missingDocs.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-muted/50 text-zinc-400">
                      <th className="px-4 py-3 text-left font-medium">Information</th>
                      <th className="px-4 py-3 text-left font-medium">Issue</th>
                      <th className="px-4 py-3 text-left font-medium">Next Follow-up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {missingDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-zinc-900/50">
                        <td className="px-4 py-3 text-zinc-200 font-medium">{doc.information}</td>
                        <td className="px-4 py-3 text-zinc-400 italic">&quot;{doc.roadblocks}&quot;</td>
                        <td className="px-4 py-3 text-zinc-400">
                          {doc.nextFollowUp ? format(new Date(doc.nextFollowUp), "MMM d, yyyy") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic py-8 text-center border border-dashed border-zinc-700 rounded-lg">No active missing documentation found.</p>
            )}
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {contactData?.contacts?.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-zinc-700 p-4 bg-zinc-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{contact.isPrimary ? "Primary Contact" : contact.title ?? "Facility Contact"}</p>
                  <p className="text-white font-medium text-lg">{contact.name}</p>
                  {contact.email && <p className="text-sm text-primary">{contact.email}</p>}
                  {contact.phone && <p className="text-sm text-zinc-400 mt-1">{contact.phone}</p>}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-zinc-700 p-6 bg-muted/10">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2"><Info className="h-4 w-4"/> Physical Address</h4>
              <p className="text-zinc-200 leading-relaxed">{contactData?.facilityInfo?.address ?? "No address recorded"}</p>
            </div>
          </div>
        )}
      </div>

      <NewLogModal
        isOpen={isModalOpen}
        editingLog={editingLog}
        onClose={() => { setIsModalOpen(false); setEditingLog(null); }}
        relatedId={facilityId}
        relatedType="facility"
        onLogCreated={handleLogCreated}
      />
    </div>
  );
}
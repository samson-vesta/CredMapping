"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Info } from "lucide-react";
import { CommLogFeed } from "./CommLogFeed";
import { MissingDocsManager } from "./MissingDocsManager";
import { StandardEmptyState } from "./StandardEmptyState";
import {
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "~/components/ui/app-modal";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { ScrollIndicatorContainer } from "~/components/ui/scroll-indicator-container";

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

const DEFAULT_FORM_DATA = {
  commType: "Email",
  subject: "",
  notes: "",
};

export function FacilityDetail({ facilityId, facility }: FacilityDetailProps) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<
    "logs" | "missing-docs" | "contacts"
  >("logs");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<{
    id: string;
    commType: string | null;
    subject: string | null;
    notes: string | null;
  } | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const [selectedCommType, setSelectedCommType] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: authUser } = api.auth.me.useQuery();
  const canCreateLog =
    authUser?.role === "admin" || authUser?.role === "superadmin";

  const { data: logs, isLoading: logsLoading } =
    api.commLogs.listByFacility.useQuery({ facilityId });
  const { data: summary } = api.commLogs.getSummary.useQuery({
    relatedId: facilityId,
    relatedType: "facility",
  });
  const { data: missingDocs, isLoading: docsLoading } =
    api.commLogs.getMissingDocs.useQuery({
      relatedId: facilityId,
      relatedType: "facility",
    });
  const { data: contactData } =
    api.commLogs.getContactsAndFacilityInfo.useQuery({ facilityId });
  const createMutation = api.commLogs.create.useMutation();
  const updateMutation = api.commLogs.update.useMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const uniqueAgents = useMemo(() => {
    if (!logs) return [];
    return Array.from(
      new Set(
        logs.map((l) => l.agentName).filter((n): n is string => n != null),
      ),
    ).sort();
  }, [logs]);

  const commTypeOptions = useMemo(() => {
    const defaults = [
      "Email",
      "Phone Call",
      "Dropbox",
      "Document",
      "Modio",
      "Meeting",
    ];
    const fromLogs = (logs ?? [])
      .map((log) => log.commType)
      .filter((type): type is string => Boolean(type));

    return Array.from(new Set([...defaults, ...fromLogs])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const result = logs
      .filter(
        (l) => selectedCommType === "all" || l.commType === selectedCommType,
      )
      .filter((l) => selectedAgent === "all" || l.agentName === selectedAgent)
      .filter((l) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return [l.subject, l.notes, l.commType, l.agentName].some((v) =>
          v?.toLowerCase().includes(q),
        );
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLog(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  useEffect(() => {
    if (!isModalOpen) return;

    if (editingLog) {
      setFormData({
        commType: editingLog.commType ?? "Email",
        subject: editingLog.subject ?? "",
        notes: editingLog.notes ?? "",
      });
      return;
    }

    setFormData(DEFAULT_FORM_DATA);
  }, [editingLog, isModalOpen]);

  const handleSubmitLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingLog) {
      await updateMutation.mutateAsync({
        id: editingLog.id,
        ...formData,
      });
    } else {
      await createMutation.mutateAsync({
        relatedId: facilityId,
        relatedType: "facility",
        ...formData,
      });
    }

    await handleLogCreated();
    handleCloseModal();
  };

  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border bg-card border-b p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="truncate text-2xl font-bold text-white">
                  {facility.name}
                </h2>
              </div>
              <p className="text-sm text-zinc-400">
                {facility.email ?? "No facility email listed"}
              </p>
            </div>
          </div>
          <span className="border-border bg-secondary text-secondary-foreground rounded border px-2 py-1 text-xs font-medium uppercase">
            {facility.state ?? "N/A"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-6">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <p className="text-zinc-400">Missing Docs:</p>
              <p
                className={`font-medium ${summary?.activeRoadblocks ? "text-rose-400" : "text-white"}`}
              >
                {summary?.activeRoadblocks ?? 0}
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <p className="text-zinc-400">Total Activity:</p>
              <p className="font-medium text-white">
                {summary?.totalLogs ?? 0} Logs
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <p className="text-zinc-400">Proxy Entity:</p>
              <p className="truncate font-medium text-white">
                {contactData?.facilityInfo?.proxy ?? "—"}
              </p>
            </div>
          </div>
          <div className="min-w-0 xl:justify-self-end">
            <div className="flex items-baseline gap-1.5 xl:justify-end">
              <p className="text-zinc-400">Status:</p>
              <p className="font-medium text-white">
                {facility.status ?? "Unknown"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-border bg-card grid grid-cols-3 gap-3 border-b px-6 py-3">
        {[
          { id: "logs", label: "Logs" },
          { id: "missing-docs", label: "Missing Docs" },
          { id: "contacts", label: "Contact Info & Notes" },
        ].map((tab) => {
          const shapeClass =
            tab.id === "logs"
              ? "rounded-tl-md rounded-br-sm"
              : tab.id === "missing-docs"
                ? "rounded-t-md"
                : "rounded-tr-md rounded-bl-sm";

          return (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(tab.id as "logs" | "missing-docs" | "contacts")
              }
              className={`border-border bg-muted/20 hover:bg-muted/30 w-full border px-4 py-2.5 text-center text-sm font-medium transition-colors ${shapeClass} ${
                activeTab === tab.id
                  ? "border-primary text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
           
                {tab.label}
          
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "logs" && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-border bg-card border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 flex-1"
                  placeholder="Search communication logs..."
                />

                {/* Sheet Filter Menu */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="h-9 gap-2">
                      <SlidersHorizontal className="h-4 w-4" /> Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="gap-0">
                    <SheetHeader>
                      <SheetTitle>Filter Logs</SheetTitle>
                    </SheetHeader>
                    <div className="border-border space-y-4 border-t px-4 py-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">
                          Log Type
                        </label>
                        <select
                          value={selectedCommType}
                          onChange={(e) => setSelectedCommType(e.target.value)}
                          className="bg-background w-full rounded border p-2 text-sm"
                        >
                          <option value="all">All Types</option>
                          {commTypeOptions.map((commType) => (
                            <option key={commType} value={commType}>
                              {commType}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">
                          Team Member
                        </label>
                        <select
                          value={selectedAgent}
                          onChange={(e) => setSelectedAgent(e.target.value)}
                          className="bg-background w-full rounded border p-2 text-sm"
                        >
                          <option value="all">All Members</option>
                          {uniqueAgents.map((a) => (
                            <option key={a} value={a}>
                              {a}
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
                            setSortOrder(e.target.value as "newest" | "oldest")
                          }
                          className="bg-background w-full rounded border p-2 text-sm"
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                        </select>
                      </div>
                    </div>
                    <SheetFooter className="px-4 py-4">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSelectedCommType("all");
                          setSelectedAgent("all");
                          setSearchQuery("");
                        }}
                      >
                        Reset
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {canCreateLog && (
                  <Button
                    onClick={() => {
                      setEditingLog(null);
                      setIsModalOpen(true);
                    }}
                    className="h-9"
                  >
                    + Add Comm Log
                  </Button>
                )}
              </div>
            </div>
            <ScrollIndicatorContainer className="min-h-0 flex-1" viewportClassName="px-6 py-4">
              <CommLogFeed
                logs={filteredLogs}
                isLoading={logsLoading}
                onSelectLog={(log) => {
                  setEditingLog(log);
                  setIsModalOpen(true);
                }}
              />
            </ScrollIndicatorContainer>
          </div>
        )}

        {activeTab === "missing-docs" && (
          <MissingDocsManager
            relatedType="facility"
            relatedId={facilityId}
            docs={missingDocs}
            isLoading={docsLoading}
            onChanged={handleLogCreated}
          />
        )}

        {activeTab === "contacts" && (
          <ScrollIndicatorContainer className="h-full" viewportClassName="p-6">
            <div className="space-y-6">
              {contactData?.contacts?.length ? (
                <div className="grid grid-cols-2 gap-4">
                  {contactData.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4"
                    >
                      <p className="mb-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                        {contact.isPrimary
                          ? "Primary Contact"
                          : (contact.title ?? "Facility Contact")}
                      </p>
                      <p className="text-lg font-medium text-white">
                        {contact.name}
                      </p>
                      {contact.email && (
                        <p className="text-primary text-sm">{contact.email}</p>
                      )}
                      {contact.phone && (
                        <p className="mt-1 text-sm text-zinc-400">
                          {contact.phone}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <StandardEmptyState message="No facility contacts recorded yet." />
              )}
              <div className="bg-muted/10 rounded-lg border border-zinc-700 p-6">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  <Info className="h-4 w-4" /> Physical Address
                </h4>
                <p className="leading-relaxed text-zinc-200">
                  {contactData?.facilityInfo?.address ?? "No address recorded"}
                </p>
              </div>
            </div>
          </ScrollIndicatorContainer>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="text-xl font-bold">
              {editingLog ? "Edit Interaction Entry" : "Log New Interaction"}
            </ModalTitle>
          </ModalHeader>

          <form className="space-y-4" onSubmit={handleSubmitLog}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Method
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onChange={(event) =>
                    setFormData({ ...formData, commType: event.target.value })
                  }
                  value={formData.commType}
                >
                  <option>Email</option>
                  <option>Phone Call</option>
                  <option>Dropbox</option>
                  <option>Document</option>
                  <option>Modio</option>
                  <option>Meeting</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Subject
                </label>
                <Input
                  onChange={(event) =>
                    setFormData({ ...formData, subject: event.target.value })
                  }
                  placeholder="e.g., PSV Follow-up"
                  required
                  value={formData.subject}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Conversation Notes
              </label>
              <Textarea
                className="resize-none"
                onChange={(event) =>
                  setFormData({ ...formData, notes: event.target.value })
                }
                placeholder="What was discussed or what happened?"
                required
                rows={6}
                value={formData.notes}
              />
            </div>

            <ModalFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button className="min-w-25" disabled={isSubmitting} type="submit">
                {isSubmitting
                  ? "Saving..."
                  : editingLog
                    ? "Save Changes"
                    : "Post Entry"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Dialog>
    </div>
  );
}

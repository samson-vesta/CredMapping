"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CommLogFeed } from "./CommLogFeed";
import { NewLogModal } from "./NewLogModal";
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
  facilityContacts?: Array<{
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }>;
}

export function FacilityDetail({
  facilityId,
  facility,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  facilityContacts = [],
}: FacilityDetailProps) {
  const [activeTab, setActiveTab] = useState<
    "logs" | "cred-docs" | "non-cred-docs" | "contacts"
  >("logs");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCommType, setSelectedCommType] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const { data: logs, isLoading: logsLoading } =
    api.commLogs.listByFacility.useQuery({ facilityId });

  const { data: summary } = api.commLogs.getFacilitySummary.useQuery({
    facilityId,
  });

  const { data: missingDocs, isLoading: docsLoading } =
    api.commLogs.getMissingDocsByFacility.useQuery({ facilityId });

  const { data: contactData, isLoading: contactsLoading } =
    api.commLogs.getContactsByFacility.useQuery({ facilityId });

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

  const isCred = facility.status === "Active";
  const credLabel = isCred ? "CRED" : "NON-CRED";

  const handleLogCreated = () => {
    // Refetch logs
    window.location.reload();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Header Card */}
      <div className="border-b border-border bg-card p-6">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-white">{facility.name}</h2>
            <span className="rounded border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
              {facility.state}
            </span>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                isCred
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-orange-500/15 text-orange-400"
              }`}
            >
              {credLabel}
            </span>
          </div>
          {facility.email && (
            <p className="text-sm text-zinc-400">{facility.email}</p>
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
            <p className="text-white font-medium">
              {facility.status ?? "Unknown"}
            </p>
          </div>
        </div>

        {(summary?.openTasksCount ?? 0) > 0 && (
          <div className="mt-4 p-3 bg-red-500/15 border border-red-500/30 rounded text-red-400 text-sm">
            ⚠ {summary?.openTasksCount} open task(s) for this facility
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border bg-card px-6">
        {[
          { id: "logs", label: "Comm Log" },
          { id: "cred-docs", label: "Missing Docs (CRED)" },
          { id: "non-cred-docs", label: "Missing Docs (NON-CRED)" },
          { id: "contacts", label: "Contact Info & Notes" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              setActiveTab(
                tab.id as
                  | "logs"
                  | "cred-docs"
                  | "non-cred-docs"
                  | "contacts"
              )
            }
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
                  <option value="Meeting">Meeting</option>
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

        {activeTab === "cred-docs" && (
          <div>
            {docsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-card rounded animate-pulse"
                  />
                ))}
              </div>
            ) : missingDocs?.cred && missingDocs.cred.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-zinc-400">
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">
                        Subject
                      </th>
                      <th className="text-left px-4 py-3 font-medium">Notes</th>
                      <th className="text-left px-4 py-3 font-medium">
                        Last F/U
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Next F/U
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {missingDocs.cred.map((doc) => {
                      const nextFollowup = doc.nextFollowupAt
                        ? new Date(doc.nextFollowupAt)
                        : null;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isPastDue = nextFollowup && nextFollowup < today;

                      const subjectDisplay = (doc.subject ?? "")
                        .replace(/^CRED\s*[–-]\s*/i, "")
                        .trim();

                      return (
                        <tr key={doc.id} className="hover:bg-zinc-900/50">
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                doc.status === "pending_response"
                                  ? "bg-yellow-500/15 text-yellow-400"
                                  : doc.status === "fu_completed"
                                    ? "bg-green-500/15 text-green-400"
                                    : doc.status === "received"
                                      ? "bg-blue-500/15 text-blue-400"
                                      : "bg-zinc-700 text-zinc-400"
                              }`}
                            >
                              ●{" "}
                              {doc.status === "pending_response"
                                ? "Pending"
                                : doc.status === "fu_completed"
                                  ? "Completed"
                                  : doc.status === "received"
                                    ? "Received"
                                    : "Closed"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {subjectDisplay}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                            {doc.notes ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {doc.lastFollowupAt != null
                              ? format(
                                  new Date(doc.lastFollowupAt),
                                  "MMM d, yyyy"
                                )
                              : "—"}
                          </td>
                          <td
                            className={`px-4 py-3 ${
                              isPastDue ? "text-red-400 font-medium" : "text-zinc-400"
                            }`}
                          >
                            {doc.nextFollowupAt != null
                              ? format(
                                  new Date(doc.nextFollowupAt),
                                  "MMM d, yyyy"
                                )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-400">
                  No credentialing missing docs for this facility
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "non-cred-docs" && (
          <div>
            {docsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-card rounded animate-pulse"
                  />
                ))}
              </div>
            ) : missingDocs?.nonCred && missingDocs.nonCred.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-zinc-400">
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">
                        Subject
                      </th>
                      <th className="text-left px-4 py-3 font-medium">Notes</th>
                      <th className="text-left px-4 py-3 font-medium">
                        Last F/U
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Next F/U
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {missingDocs.nonCred.map((doc) => {
                      const nextFollowup = doc.nextFollowupAt
                        ? new Date(doc.nextFollowupAt)
                        : null;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isPastDue = nextFollowup && nextFollowup < today;

                      const subjectDisplay = (doc.subject ?? "")
                        .replace(/^NON-CRED\s*[–-]\s*/i, "")
                        .trim();

                      return (
                        <tr key={doc.id} className="hover:bg-zinc-900/50">
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                doc.status === "pending_response"
                                  ? "bg-yellow-500/15 text-yellow-400"
                                  : doc.status === "fu_completed"
                                    ? "bg-green-500/15 text-green-400"
                                    : doc.status === "received"
                                      ? "bg-blue-500/15 text-blue-400"
                                      : "bg-zinc-700 text-zinc-400"
                              }`}
                            >
                              ●{" "}
                              {doc.status === "pending_response"
                                ? "Pending"
                                : doc.status === "fu_completed"
                                  ? "Completed"
                                  : doc.status === "received"
                                    ? "Received"
                                    : "Closed"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {subjectDisplay}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                            {doc.notes ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {doc.lastFollowupAt != null
                              ? format(
                                  new Date(doc.lastFollowupAt),
                                  "MMM d, yyyy"
                                )
                              : "—"}
                          </td>
                          <td
                            className={`px-4 py-3 ${
                              isPastDue ? "text-red-400 font-medium" : "text-zinc-400"
                            }`}
                          >
                            {doc.nextFollowupAt != null
                              ? format(
                                  new Date(doc.nextFollowupAt),
                                  "MMM d, yyyy"
                                )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-400">
                  No non-credentialing missing docs for this facility
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "contacts" && (
          <div>
            {contactsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 bg-card rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Primary Contact Card */}
                {contactData?.contacts?.filter((c) => c.isPrimary).map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                      >
                        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3 font-medium">
                          Primary Contact
                        </p>
                        <p className="text-sm font-medium text-zinc-200">
                          {contact.name}
                        </p>
                        {contact.title && (
                          <p className="text-sm text-zinc-400 mt-1">
                            {contact.title}
                          </p>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-sm text-blue-400 hover:text-blue-300 mt-2 block"
                          >
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <p className="text-sm text-zinc-400 mt-1">
                            {contact.phone}
                          </p>
                        )}
                      </div>
                    ))}

                {/* Other Contacts Card */}
                {contactData?.contacts?.filter((c) => !c.isPrimary).slice(0, 1).map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                      >
                        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3 font-medium">
                          {contact.title ?? "Credentialing Contact"}
                        </p>
                        <p className="text-sm font-medium text-zinc-200">
                          {contact.name}
                        </p>
                        {contact.title && (
                          <p className="text-sm text-zinc-400 mt-1">
                            {contact.title}
                          </p>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-sm text-blue-400 hover:text-blue-300 mt-2 block"
                          >
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <p className="text-sm text-zinc-400 mt-1">
                            {contact.phone}
                          </p>
                        )}
                      </div>
                    ))}

                {/* Facility Info Card - Full Width */}
                <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3 font-medium">
                    Facility Details
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Proxy Info</p>
                      <p className="text-sm text-zinc-200">
                        {contactData?.facilityInfo?.proxy ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">TAT / SLA</p>
                      <p className="text-sm text-zinc-200">
                        {contactData?.facilityInfo?.tatSla ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Address</p>
                      <p className="text-sm text-zinc-200">
                        {contactData?.facilityInfo?.address ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Empty State */}
                {!contactData?.contacts?.length ? (
                  <div className="col-span-2 text-center py-8">
                    <p className="text-sm text-zinc-600 italic">
                      No contacts added yet
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      <NewLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        relatedId={facilityId}
        relatedType="facility"
        onLogCreated={handleLogCreated}
      />
    </div>
  );
}

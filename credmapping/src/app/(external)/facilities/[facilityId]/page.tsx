import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  Mail,
  MapPin,
  Phone,
  Rocket,
  Stethoscope,
  User,
} from "lucide-react";
import { ActivityTimeline } from "~/components/audit-log/ActivityTimeline";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CollapsibleSection } from "~/components/ui/collapsible-section";
import { db } from "~/server/db";
import {
  agents,
  facilities,
  facilityContacts,
  facilityPreliveInfo,
  providerFacilityCredentials,
  providers,
  workflowPhases,
} from "~/server/db/schema";
import {
  EditFacilityDialog,
  DeleteFacilityDialog,
} from "~/components/facilities/facility-actions";

/* ─── Helpers ──────────────────────────────────────────────────── */

const formatDate = (value: Date | string | null) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const asDateInput = (value: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const formatProviderName = (provider: {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  degree: string | null;
}) => {
  const fullName = [provider.firstName, provider.middleName, provider.lastName]
    .filter(Boolean)
    .join(" ");
  if (!fullName) return "Unnamed Provider";
  return provider.degree ? `${fullName}, ${provider.degree}` : fullName;
};

const sanitizePhoneForHref = (value: string) => value.replace(/[^\d+]/g, "");

const getStatusTone = (status: string | null) => {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "inactive")
    return "border-zinc-500/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  if (normalized === "in progress")
    return "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
};

const getDueDateTone = (value: Date | string | null) => {
  if (!value) return "text-muted-foreground";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "text-muted-foreground";
  const days = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-red-600 dark:text-red-400";
  if (days <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const parseRoles = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

/* ─── Page ─────────────────────────────────────────────────────── */

export default async function FacilityProfilePage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId } = await params;

  const facilityRow = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  const facility = facilityRow[0];
  if (!facility) notFound();

  /* ── Parallel data loads ──────────────────────────────────── */

  const [contactRows, preliveRows, credentialRows] = await Promise.all([
    db
      .select()
      .from(facilityContacts)
      .where(eq(facilityContacts.facilityId, facilityId))
      .orderBy(desc(facilityContacts.isPrimary), facilityContacts.name),
    db
      .select()
      .from(facilityPreliveInfo)
      .where(eq(facilityPreliveInfo.facilityId, facilityId))
      .orderBy(desc(facilityPreliveInfo.updatedAt)),
    db
      .select({
        id: providerFacilityCredentials.id,
        providerId: providerFacilityCredentials.providerId,
        providerFirstName: providers.firstName,
        providerMiddleName: providers.middleName,
        providerLastName: providers.lastName,
        providerDegree: providers.degree,
        facilityType: providerFacilityCredentials.facilityType,
        priority: providerFacilityCredentials.priority,
        decision: providerFacilityCredentials.decision,
        privileges: providerFacilityCredentials.privileges,
        notes: providerFacilityCredentials.notes,
        formSize: providerFacilityCredentials.formSize,
        applicationRequired: providerFacilityCredentials.applicationRequired,
        updatedAt: providerFacilityCredentials.updatedAt,
      })
      .from(providerFacilityCredentials)
      .leftJoin(providers, eq(providerFacilityCredentials.providerId, providers.id))
      .where(eq(providerFacilityCredentials.facilityId, facilityId))
      .orderBy(desc(providerFacilityCredentials.updatedAt)),
  ]);

  /* ── Workflow phases for credentials ──────────────────────── */

  const credentialIds = credentialRows.map((row) => row.id);

  const workflowRows =
    credentialIds.length === 0
      ? []
      : await db
          .select({
            id: workflowPhases.id,
            relatedId: workflowPhases.relatedId,
            phaseName: workflowPhases.phaseName,
            status: workflowPhases.status,
            startDate: workflowPhases.startDate,
            dueDate: workflowPhases.dueDate,
            completedAt: workflowPhases.completedAt,
            updatedAt: workflowPhases.updatedAt,
            agentFirstName: agents.firstName,
            agentLastName: agents.lastName,
          })
          .from(workflowPhases)
          .leftJoin(agents, eq(workflowPhases.agentAssigned, agents.id))
          .where(
            and(
              eq(workflowPhases.workflowType, "pfc"),
              inArray(workflowPhases.relatedId, credentialIds),
            ),
          )
          .orderBy(asc(workflowPhases.phaseName), desc(workflowPhases.updatedAt));

  const normalizedWorkflowRows = workflowRows.map((row) => ({
    id: row.id,
    relatedId: row.relatedId,
    phaseName: row.phaseName,
    status: row.status,
    startDate: asDateInput(row.startDate),
    dueDate: asDateInput(row.dueDate),
    completedAt: asDateInput(row.completedAt),
    updatedAt: formatDate(row.updatedAt),
    agentName:
      row.agentFirstName || row.agentLastName
        ? `${row.agentFirstName ?? ""} ${row.agentLastName ?? ""}`.trim()
        : null,
  }));

  const workflowsByCredential = new Map<string, typeof normalizedWorkflowRows>();
  for (const workflow of normalizedWorkflowRows) {
    const current = workflowsByCredential.get(workflow.relatedId) ?? [];
    current.push(workflow);
    workflowsByCredential.set(workflow.relatedId, current);
  }

  /* ── Derived data ─────────────────────────────────────────── */

  const totalWorkflowPhases = credentialIds.reduce(
    (sum, id) => sum + (workflowsByCredential.get(id)?.length ?? 0),
    0,
  );

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-4 pb-4">
      {/* ── Hero header ───────────────────────────────────────── */}
      <section className="rounded-xl border  p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
              <Building2 className="size-4" /> Facility profile
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {facility.name ?? "Unnamed Facility"}
            </h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {facility.state && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {facility.state}
                </span>
              )}
              {facility.email && (
                <a className="flex items-center gap-1 hover:underline" href={`mailto:${facility.email}`}>
                  <Mail className="size-3.5" /> {facility.email}
                </a>
              )}
              {facility.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {facility.address}
                </span>
              )}
            </div>
            <Badge className={`${getStatusTone(facility.status)}`} variant="outline">
              {facility.status ?? "Unknown"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <EditFacilityDialog facility={facility} />
            <DeleteFacilityDialog facilityId={facility.id} facilityName={facility.name ?? "Unnamed"} />
            <Button asChild variant="outline">
              <Link href="/facilities">Back to facilities</Link>
            </Button>
          </div>
        </div>

        {/* Inline details */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {facility.proxy && <span>Proxy: {facility.proxy}</span>}
          {facility.yearlyVolume !== null && <span>Volume: {facility.yearlyVolume?.toLocaleString()}</span>}
          {facility.tatSla && <span>TAT/SLA: {facility.tatSla}</span>}
          {facility.modalities && facility.modalities.length > 0 && (
            <span>Modalities: {facility.modalities.join(", ")}</span>
          )}
          <span>Created {formatDate(facility.createdAt)}</span>
          <span>·</span>
          <span>Updated {formatDate(facility.updatedAt)}</span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">Contacts</p>
            <p className="text-xl font-semibold">{contactRows.length}</p>
          </div>
          <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">Credentialed providers</p>
            <p className="text-xl font-semibold">{credentialRows.length}</p>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">Workflow phases</p>
            <p className="text-xl font-semibold">{totalWorkflowPhases}</p>
          </div>
          <div className="rounded-md border border-violet-500/40 bg-violet-500/10 p-3">
            <p className="text-xs text-violet-700 dark:text-violet-300">Pre-live records</p>
            <p className="text-xl font-semibold">{preliveRows.length}</p>
          </div>
        </div>
      </section>

      {/* ── Contacts ──────────────────────────────────────────── */}
      <CollapsibleSection
        title={<span className="flex items-center gap-2"><User className="size-4" /> Facility contacts</span>}
        badge={contactRows.length}
        maxHeight="20rem"
      >
        {contactRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No contacts found for this facility.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="py-1 pr-3">Name</th>
                    <th className="py-1 pr-3">Title</th>
                    <th className="py-1 pr-3">Email</th>
                    <th className="py-1 pr-3">Phone</th>
                    <th className="py-1 pr-3">Primary</th>
                  </tr>
                </thead>
                <tbody>
                  {contactRows.map((contact) => (
                    <tr key={contact.id} className="border-t">
                      <td className="py-1 pr-3 font-medium">{contact.name}</td>
                      <td className="py-1 pr-3">{contact.title ?? "—"}</td>
                      <td className="py-1 pr-3">
                        {contact.email ? (
                          <a className="flex items-center gap-1 hover:underline" href={`mailto:${contact.email}`}>
                            <Mail className="size-3" /> {contact.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-3">
                        {contact.phone ? (
                          <a className="flex items-center gap-1 hover:underline" href={`tel:${sanitizePhoneForHref(contact.phone)}`}>
                            <Phone className="size-3" /> {contact.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-3">
                        {contact.isPrimary ? (
                          <Badge className="border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" variant="outline">
                            Primary
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </CollapsibleSection>

      {/* ── Pre-live info ─────────────────────────────────────── */}
      <CollapsibleSection
        title={<span className="flex items-center gap-2"><Rocket className="size-4" /> Pre-live pipeline</span>}
        badge={preliveRows.length}
        maxHeight="24rem"
      >
        {preliveRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pre-live records found for this facility.</p>
        ) : (
          <div className="space-y-3">
            {preliveRows.map((prelive) => {
              const roles = parseRoles(prelive.rolesNeeded);
              return (
                <div key={prelive.id} className="rounded-md border p-3">
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <p className="text-muted-foreground text-xs">Priority</p>
                      <p className="text-sm font-medium">{prelive.priority ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Go-live date</p>
                      <p className={`text-sm font-medium ${getDueDateTone(prelive.goLiveDate)}`}>
                        {formatDate(prelive.goLiveDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Credentialing due</p>
                      <p className={`text-sm font-medium ${getDueDateTone(prelive.credentialingDueDate)}`}>
                        {formatDate(prelive.credentialingDueDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Board meeting</p>
                      <p className="text-sm font-medium">{formatDate(prelive.boardMeetingDate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Temps possible</p>
                      <p className="text-sm font-medium">
                        {prelive.tempsPossible === null ? "—" : prelive.tempsPossible ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Payor enrollment</p>
                      <p className="text-sm font-medium">
                        {prelive.payorEnrollmentRequired === null
                          ? "—"
                          : prelive.payorEnrollmentRequired
                            ? "Required"
                            : "Not required"}
                      </p>
                    </div>
                  </div>
                  {roles.length > 0 && (
                    <div className="mt-2">
                      <p className="text-muted-foreground text-xs">Roles needed</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Provider credential sub-workflows ─────────────────── */}
      <CollapsibleSection
        title={<span className="flex items-center gap-2"><Stethoscope className="size-4" /> Provider credential sub-workflows</span>}
        badge={credentialRows.length}
        maxHeight="32rem"
      >
        {credentialRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No provider credentials exist for this facility.
          </p>
        ) : (
          <div className="space-y-2">
            {credentialRows.map((credential) => {
              const workflowList = workflowsByCredential.get(credential.id) ?? [];
              const providerName = formatProviderName({
                firstName: credential.providerFirstName,
                middleName: credential.providerMiddleName,
                lastName: credential.providerLastName,
                degree: credential.providerDegree,
              });
              const isHighPriority = (credential.priority ?? "").toLowerCase().includes("high");

              return (
                <div
                  key={credential.id}
                  className={`rounded-lg border p-3 ${
                    isHighPriority ? "border-amber-400/60 bg-amber-500/5" : "border-border"
                  }`}
                >
                  {/* ── Compact horizontal header ── */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-sm font-semibold leading-tight">
                      {credential.providerId ? (
                        <Link className="hover:underline" href={`/providers/${credential.providerId}`}>
                          {providerName}
                        </Link>
                      ) : (
                        providerName
                      )}
                    </h3>
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0">{credential.priority ?? "—"}</Badge>
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0">{credential.decision ?? "—"}</Badge>
                    {credential.privileges && (
                      <Badge variant="outline" className="text-[11px] px-1.5 py-0">{credential.privileges}</Badge>
                    )}
                    {credential.facilityType && (
                      <span className="text-muted-foreground text-[11px]">{credential.facilityType}</span>
                    )}
                    {credential.applicationRequired !== null && (
                      <span className="text-muted-foreground text-[11px]">App: {credential.applicationRequired ? "Yes" : "No"}</span>
                    )}
                    {isHighPriority && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300 font-medium">
                        <AlertTriangle className="size-3" /> High
                      </span>
                    )}
                    {credential.notes && (
                      <span className="text-muted-foreground text-[11px] max-w-xs truncate" title={credential.notes}>{credential.notes}</span>
                    )}
                    <span className="text-muted-foreground text-[11px] ml-auto shrink-0">Updated {formatDate(credential.updatedAt)}</span>
                  </div>

                  {/* ── Workflow table ── */}
                  {workflowList.length === 0 ? (
                    <p className="text-muted-foreground text-xs mt-1">No workflow phases linked.</p>
                  ) : (
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-left text-xs">
                        <thead className="text-muted-foreground uppercase">
                          <tr>
                            <th className="py-1 pr-3 font-medium">Phase</th>
                            <th className="py-1 pr-3 font-medium">Status</th>
                            <th className="py-1 pr-3 font-medium">Start</th>
                            <th className="py-1 pr-3 font-medium">Due</th>
                            <th className="py-1 pr-3 font-medium">Completed</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {workflowList.map((workflow) => (
                            <tr key={workflow.id} className="border-t">
                              <td className="py-1 pr-3">{workflow.phaseName}</td>
                              <td className="py-1 pr-3">{workflow.status ?? "—"}</td>
                              <td className="py-1 pr-3">{workflow.startDate ?? "—"}</td>
                              <td className={`py-1 pr-3 ${getDueDateTone(workflow.dueDate)}`}>
                                {workflow.dueDate ?? "—"}
                              </td>
                              <td className="py-1 pr-3">{workflow.completedAt ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Activity Timeline ─────────────────────────────────── */}
      <CollapsibleSection
        title={<span className="flex items-center gap-2"><Activity className="size-5" /> Activity Log</span>}
        defaultOpen={false}
      >
        <ActivityTimeline entityType="facility" entityId={facilityId} />
      </CollapsibleSection>
    </div>
  );
}

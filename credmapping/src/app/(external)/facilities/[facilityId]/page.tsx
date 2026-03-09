import { and, asc, desc, eq, inArray } from "drizzle-orm";
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
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline } from "~/components/audit-log/ActivityTimeline";
import {
  DeleteFacilityDialog,
  EditFacilityDialog,
} from "~/components/facilities/facility-actions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CollapsibleSection } from "~/components/ui/collapsible-section";
import { requireRequestAuthContext } from "~/server/auth/request-context";
import { withUserDb } from "~/server/db";
import {
  agents,
  facilities,
  facilityContacts,
  facilityPreliveInfo,
  providerFacilityCredentials,
  providers,
  workflowPhases,
} from "~/server/db/schema";

const formatDate = (value: Date | string | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const asDateInput = (value: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const formatProviderName = (provider: {
  degree: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
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
  if (normalized === "inactive") {
    return "border-zinc-500/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  if (normalized === "in progress") {
    return "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }
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

export default async function FacilityProfilePage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId } = await params;
  const { user } = await requireRequestAuthContext();

  const { contactRows, credentialRows, facility, preliveRows, workflowRows } =
    await withUserDb({
      user,
      run: async (db) => {
        const [facilityRow, contactRows, preliveRows, credentialRows] = await Promise.all([
          db.select().from(facilities).where(eq(facilities.id, facilityId)).limit(1),
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
              applicationRequired: providerFacilityCredentials.applicationRequired,
              decision: providerFacilityCredentials.decision,
              facilityType: providerFacilityCredentials.facilityType,
              formSize: providerFacilityCredentials.formSize,
              id: providerFacilityCredentials.id,
              notes: providerFacilityCredentials.notes,
              privileges: providerFacilityCredentials.privileges,
              priority: providerFacilityCredentials.priority,
              providerDegree: providers.degree,
              providerFirstName: providers.firstName,
              providerId: providerFacilityCredentials.providerId,
              providerLastName: providers.lastName,
              providerMiddleName: providers.middleName,
              updatedAt: providerFacilityCredentials.updatedAt,
            })
            .from(providerFacilityCredentials)
            .leftJoin(providers, eq(providerFacilityCredentials.providerId, providers.id))
            .where(eq(providerFacilityCredentials.facilityId, facilityId))
            .orderBy(desc(providerFacilityCredentials.updatedAt)),
        ]);

        const credentialIds = credentialRows.map((row) => row.id);
        const workflowRows =
          credentialIds.length === 0
            ? []
            : await db
                .select({
                  agentFirstName: agents.firstName,
                  agentLastName: agents.lastName,
                  completedAt: workflowPhases.completedAt,
                  dueDate: workflowPhases.dueDate,
                  id: workflowPhases.id,
                  phaseName: workflowPhases.phaseName,
                  relatedId: workflowPhases.relatedId,
                  startDate: workflowPhases.startDate,
                  status: workflowPhases.status,
                  updatedAt: workflowPhases.updatedAt,
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

        return {
          contactRows,
          credentialRows,
          facility: facilityRow[0] ?? null,
          preliveRows,
          workflowRows,
        };
      },
    });

  if (!facility) notFound();

  const normalizedWorkflowRows = workflowRows.map((row) => ({
    agentName:
      row.agentFirstName || row.agentLastName
        ? `${row.agentFirstName ?? ""} ${row.agentLastName ?? ""}`.trim()
        : null,
    completedAt: asDateInput(row.completedAt),
    dueDate: asDateInput(row.dueDate),
    id: row.id,
    phaseName: row.phaseName,
    relatedId: row.relatedId,
    startDate: asDateInput(row.startDate),
    status: row.status,
    updatedAt: formatDate(row.updatedAt),
  }));

  const workflowsByCredential = new Map<string, typeof normalizedWorkflowRows>();
  for (const workflow of normalizedWorkflowRows) {
    const current = workflowsByCredential.get(workflow.relatedId) ?? [];
    current.push(workflow);
    workflowsByCredential.set(workflow.relatedId, current);
  }

  const totalWorkflowPhases = credentialRows.reduce(
    (sum, row) => sum + (workflowsByCredential.get(row.id)?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-xl border p-5">
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
            <Badge className={getStatusTone(facility.status)} variant="outline">
              {facility.status ?? "Unknown"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <EditFacilityDialog facility={facility} />
            <DeleteFacilityDialog
              facilityId={facility.id}
              facilityName={facility.name ?? "Unnamed"}
            />
            <Button asChild variant="outline">
              <Link href="/facilities">Back to facilities</Link>
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {facility.proxy && <span>Proxy: {facility.proxy}</span>}
          {facility.yearlyVolume !== null && (
            <span>Volume: {facility.yearlyVolume?.toLocaleString()}</span>
          )}
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

      <CollapsibleSection
        badge={contactRows.length}
        maxHeight="20rem"
        title={
          <span className="flex items-center gap-2">
            <User className="size-4" /> Facility contacts
          </span>
        }
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
                    <td className="py-1 pr-3">{contact.title ?? "-"}</td>
                    <td className="py-1 pr-3">
                      {contact.email ? (
                        <a className="flex items-center gap-1 hover:underline" href={`mailto:${contact.email}`}>
                          <Mail className="size-3" /> {contact.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-1 pr-3">
                      {contact.phone ? (
                        <a
                          className="flex items-center gap-1 hover:underline"
                          href={`tel:${sanitizePhoneForHref(contact.phone)}`}
                        >
                          <Phone className="size-3" /> {contact.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-1 pr-3">
                      {contact.isPrimary ? (
                        <Badge
                          className="border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          variant="outline"
                        >
                          Primary
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        badge={preliveRows.length}
        maxHeight="24rem"
        title={
          <span className="flex items-center gap-2">
            <Rocket className="size-4" /> Pre-live pipeline
          </span>
        }
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
                      <p className="text-sm font-medium">{prelive.priority ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Go-live date</p>
                      <p className={`text-sm font-medium ${getDueDateTone(prelive.goLiveDate)}`}>
                        {formatDate(prelive.goLiveDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Credentialing due</p>
                      <p
                        className={`text-sm font-medium ${getDueDateTone(prelive.credentialingDueDate)}`}
                      >
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
                        {prelive.tempsPossible === null ? "-" : prelive.tempsPossible ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Payor enrollment</p>
                      <p className="text-sm font-medium">
                        {prelive.payorEnrollmentRequired === null
                          ? "-"
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
                          <Badge key={role} className="text-xs" variant="outline">
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

      <CollapsibleSection
        badge={credentialRows.length}
        maxHeight="32rem"
        title={
          <span className="flex items-center gap-2">
            <Stethoscope className="size-4" /> Provider credential sub-workflows
          </span>
        }
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
                degree: credential.providerDegree,
                firstName: credential.providerFirstName,
                lastName: credential.providerLastName,
                middleName: credential.providerMiddleName,
              });
              const isHighPriority = (credential.priority ?? "").toLowerCase().includes("high");

              return (
                <div
                  key={credential.id}
                  className={`rounded-lg border p-3 ${
                    isHighPriority ? "border-amber-400/60 bg-amber-500/5" : "border-border"
                  }`}
                >
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
                    <Badge className="text-[11px] px-1.5 py-0" variant="outline">
                      {credential.priority ?? "-"}
                    </Badge>
                    <Badge className="text-[11px] px-1.5 py-0" variant="outline">
                      {credential.decision ?? "-"}
                    </Badge>
                    {credential.privileges && (
                      <Badge className="text-[11px] px-1.5 py-0" variant="outline">
                        {credential.privileges}
                      </Badge>
                    )}
                    {credential.facilityType && (
                      <span className="text-muted-foreground text-[11px]">{credential.facilityType}</span>
                    )}
                    {credential.applicationRequired !== null && (
                      <span className="text-muted-foreground text-[11px]">
                        App: {credential.applicationRequired ? "Yes" : "No"}
                      </span>
                    )}
                    {isHighPriority && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                        <AlertTriangle className="size-3" /> High
                      </span>
                    )}
                    {credential.notes && (
                      <span className="text-muted-foreground max-w-xs truncate text-[11px]" title={credential.notes}>
                        {credential.notes}
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
                      Updated {formatDate(credential.updatedAt)}
                    </span>
                  </div>

                  {workflowList.length === 0 ? (
                    <p className="text-muted-foreground mt-1 text-xs">No workflow phases linked.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
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
                              <td className="py-1 pr-3">{workflow.status ?? "-"}</td>
                              <td className="py-1 pr-3">{workflow.startDate ?? "-"}</td>
                              <td className={`py-1 pr-3 ${getDueDateTone(workflow.dueDate)}`}>
                                {workflow.dueDate ?? "-"}
                              </td>
                              <td className="py-1 pr-3">{workflow.completedAt ?? "-"}</td>
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

      <CollapsibleSection
        defaultOpen={false}
        title={
          <span className="flex items-center gap-2">
            <Activity className="size-5" /> Activity Log
          </span>
        }
      >
        <ActivityTimeline entityId={facilityId} entityType="facility" />
      </CollapsibleSection>
    </div>
  );
}

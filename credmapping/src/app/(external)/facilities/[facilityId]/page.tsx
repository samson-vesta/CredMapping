import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  Rocket,
  Stethoscope,
  User,
} from "lucide-react";
import { WorkflowPhaseDrawer } from "~/components/providers/workflow-phase-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
  if (normalized === "inactive") return "border-zinc-400/60 text-zinc-300";
  if (normalized === "in progress") return "border-blue-400/60 text-blue-300";
  return "border-emerald-400/60 text-emerald-300";
};

const getDueDateTone = (value: Date | string | null) => {
  if (!value) return "text-muted-foreground";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "text-muted-foreground";
  const days = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-red-300";
  if (days <= 30) return "text-amber-300";
  return "text-emerald-300";
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

  /* ── Server action ────────────────────────────────────────── */

  async function updateWorkflowPhaseAction(formData: FormData) {
    "use server";

    const getText = (key: string) => {
      const value = formData.get(key);
      return typeof value === "string" ? value.trim() : "";
    };

    const workflowId = getText("workflowId");
    const credentialId = getText("providerCredentialId");
    const phaseName = getText("phaseName");
    const status = getText("status");
    const startDate = getText("startDate");
    const dueDate = getText("dueDate");
    const completedAt = getText("completedAt");

    if (!workflowId || !credentialId || !phaseName || !startDate || !dueDate) return;

    const [workflow] = await db
      .select({
        id: workflowPhases.id,
        workflowType: workflowPhases.workflowType,
      })
      .from(workflowPhases)
      .where(and(eq(workflowPhases.id, workflowId), eq(workflowPhases.relatedId, credentialId)))
      .limit(1);

    if (workflow?.workflowType !== "pfc") return;

    await db
      .update(workflowPhases)
      .set({
        phaseName,
        status: status || "Pending",
        startDate,
        dueDate,
        completedAt: completedAt || null,
        updatedAt: new Date(),
      })
      .where(eq(workflowPhases.id, workflowId));

    revalidatePath(`/facilities/${facilityId}`);
    revalidatePath("/facilities");
  }

  /* ── Derived data ─────────────────────────────────────────── */

  const totalWorkflowPhases = credentialIds.reduce(
    (sum, id) => sum + (workflowsByCredential.get(id)?.length ?? 0),
    0,
  );

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-6 pb-4">
      {/* ── Hero header ───────────────────────────────────────── */}
      <section className="rounded-xl border bg-gradient-to-r from-emerald-950/20 via-background to-blue-950/20 p-5">
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
            <Badge className={`bg-transparent ${getStatusTone(facility.status)}`} variant="outline">
              {facility.status ?? "Unknown"}
            </Badge>
          </div>
          <Button asChild variant="outline">
            <Link href="/facilities">Back to facilities</Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-200">Contacts</p>
            <p className="text-xl font-semibold">{contactRows.length}</p>
          </div>
          <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3">
            <p className="text-xs text-blue-200">Credentialed providers</p>
            <p className="text-xl font-semibold">{credentialRows.length}</p>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-200">Workflow phases</p>
            <p className="text-xl font-semibold">{totalWorkflowPhases}</p>
          </div>
          <div className="rounded-md border border-violet-500/40 bg-violet-500/10 p-3">
            <p className="text-xs text-violet-200">Pre-live records</p>
            <p className="text-xl font-semibold">{preliveRows.length}</p>
          </div>
        </div>
      </section>

      {/* ── Contacts + Facility details ───────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border p-4 lg:col-span-2">
          <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs uppercase">
            <User className="size-4" /> Facility contacts
          </p>
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
                    <th className="py-1">Primary</th>
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
                      <td className="py-1">
                        {contact.isPrimary ? (
                          <Badge className="border-emerald-400/60 bg-transparent text-emerald-300" variant="outline">
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
        </article>

        <article className="rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs uppercase">
            <CalendarClock className="size-4" /> Facility details
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{facility.status ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Proxy</dt>
              <dd>{facility.proxy ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Yearly volume</dt>
              <dd>{facility.yearlyVolume?.toLocaleString() ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">TAT / SLA</dt>
              <dd>{facility.tatSla ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Modalities</dt>
              <dd>{facility.modalities?.join(", ") ?? "—"}</dd>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(facility.createdAt)}</dd>
              </div>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{formatDate(facility.updatedAt)}</dd>
            </div>
          </dl>
        </article>
      </section>

      {/* ── Pre-live info ─────────────────────────────────────── */}
      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs uppercase">
          <Rocket className="size-4" /> Pre-live pipeline
        </p>
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
      </section>

      {/* ── Provider credential sub-workflows ─────────────────── */}
      <section className="space-y-3">
        <p className="text-muted-foreground flex items-center gap-2 text-xs uppercase">
          <Stethoscope className="size-4" /> Provider credential sub-workflows
        </p>
        {credentialRows.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No provider credentials exist for this facility.
          </div>
        ) : (
          credentialRows.map((credential) => {
            const workflowList = workflowsByCredential.get(credential.id) ?? [];
            const providerName = formatProviderName({
              firstName: credential.providerFirstName,
              middleName: credential.providerMiddleName,
              lastName: credential.providerLastName,
              degree: credential.providerDegree,
            });
            const isHighPriority = (credential.priority ?? "").toLowerCase().includes("high");

            return (
              <article
                key={credential.id}
                className={`rounded-lg border p-4 ${
                  isHighPriority ? "border-amber-400/60 bg-amber-500/5" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {credential.providerId ? (
                        <Link className="hover:underline" href={`/providers/${credential.providerId}`}>
                          {providerName}
                        </Link>
                      ) : (
                        providerName
                      )}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Priority: {credential.priority ?? "—"} · Decision:{" "}
                      {credential.decision ?? "—"} · Privileges: {credential.privileges ?? "—"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {isHighPriority ? (
                      <p className="flex items-center gap-1 text-amber-300">
                        <AlertTriangle className="size-4" /> High priority
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">Updated {formatDate(credential.updatedAt)}</p>
                  </div>
                </div>

                <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {credential.facilityType && <span>Type: {credential.facilityType}</span>}
                  {credential.applicationRequired !== null && (
                    <span>Application: {credential.applicationRequired ? "Required" : "Not required"}</span>
                  )}
                </div>

                <p className="text-muted-foreground mt-2 text-sm">{credential.notes ?? "No notes"}</p>

                {workflowList.length === 0 ? (
                  <p className="text-muted-foreground mt-3 text-sm">No workflow phases linked.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="py-1 pr-3">Phase</th>
                          <th className="py-1 pr-3">Status</th>
                          <th className="py-1 pr-3">Start</th>
                          <th className="py-1 pr-3">Due</th>
                          <th className="py-1 pr-3">Completed</th>
                          <th className="py-1">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflowList.map((workflow) => (
                          <tr key={workflow.id} className="border-t">
                            <td className="py-1 pr-3">{workflow.phaseName}</td>
                            <td className="py-1 pr-3">{workflow.status ?? "—"}</td>
                            <td className="py-1 pr-3">{workflow.startDate ?? "—"}</td>
                            <td className={`py-1 pr-3 ${getDueDateTone(workflow.dueDate)}`}>
                              {workflow.dueDate ?? "—"}
                            </td>
                            <td className="py-1 pr-3">{workflow.completedAt ?? "—"}</td>
                            <td className="py-1">
                              <WorkflowPhaseDrawer
                                timeline={workflowList}
                                updateAction={updateWorkflowPhaseAction}
                                workflow={{
                                  ...workflow,
                                  facilityName: facility.name ?? "Unknown facility",
                                  providerCredentialId: credential.id,
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

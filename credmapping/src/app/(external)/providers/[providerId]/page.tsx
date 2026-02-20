import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { WorkflowPhaseDrawer } from "~/components/providers/workflow-phase-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { db } from "~/server/db";
import {
  agents,
  facilities,
  providerFacilityCredentials,
  providerStateLicenses,
  providers,
  providerVestaPrivileges,
  workflowPhases,
} from "~/server/db/schema";

const formatDate = (value: Date | string | null) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const formatName = (provider: {
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

const asDateInput = (value: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getLicenseStatusTone = (value: Date | string | null) => {
  if (!value) return "text-muted-foreground";
  const expiry = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(expiry.getTime())) return "text-muted-foreground";
  const days = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-red-300";
  if (days <= 90) return "text-amber-300";
  return "text-emerald-300";
};

const getPrivilegeTone = (tier: string | null) => {
  const normalized = tier?.toLowerCase() ?? "";
  if (normalized.includes("inactive")) return "text-zinc-300 border-zinc-400/60";
  if (normalized.includes("progress")) return "text-blue-300 border-blue-400/60";
  if (normalized.includes("temp")) return "text-amber-300 border-amber-400/60";
  if (normalized.includes("full")) return "text-emerald-300 border-emerald-400/60";
  return "text-muted-foreground border-border";
};

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;

  const providerRow = await db
    .select({
      id: providers.id,
      firstName: providers.firstName,
      middleName: providers.middleName,
      lastName: providers.lastName,
      degree: providers.degree,
      email: providers.email,
      phone: providers.phone,
      createdAt: providers.createdAt,
      updatedAt: providers.updatedAt,
      notes: providers.notes,
    })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  const provider = providerRow[0];
  if (!provider) notFound();

  const [licenseRows, privilegeRows, credentials] = await Promise.all([
    db
      .select()
      .from(providerStateLicenses)
      .where(eq(providerStateLicenses.providerId, providerId))
      .orderBy(desc(providerStateLicenses.expiresAt), desc(providerStateLicenses.createdAt)),
    db
      .select()
      .from(providerVestaPrivileges)
      .where(eq(providerVestaPrivileges.providerId, providerId))
      .orderBy(desc(providerVestaPrivileges.updatedAt)),
    db
      .select({
        id: providerFacilityCredentials.id,
        facilityName: facilities.name,
        facilityType: providerFacilityCredentials.facilityType,
        priority: providerFacilityCredentials.priority,
        decision: providerFacilityCredentials.decision,
        notes: providerFacilityCredentials.notes,
        privileges: providerFacilityCredentials.privileges,
        updatedAt: providerFacilityCredentials.updatedAt,
      })
      .from(providerFacilityCredentials)
      .leftJoin(facilities, eq(providerFacilityCredentials.facilityId, facilities.id))
      .where(eq(providerFacilityCredentials.providerId, providerId))
      .orderBy(desc(providerFacilityCredentials.updatedAt)),
  ]);

  const credentialIds = credentials.map((item) => item.id);

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

    revalidatePath(`/providers/${providerId}`);
    revalidatePath("/providers");
  }

  return (
    <div className="space-y-6 pb-4">
      <section className="rounded-xl border bg-gradient-to-r from-blue-950/20 via-background to-emerald-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
              <Stethoscope className="size-4" /> Provider profile
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{formatName(provider)}</h1>
            <p className="text-muted-foreground text-sm">{provider.email ?? "No email"} · {provider.phone ?? "No phone"}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/providers">Back to providers</Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3">
            <p className="text-xs text-blue-200">State licenses</p>
            <p className="text-xl font-semibold">{licenseRows.length}</p>
          </div>
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-200">Privilege records</p>
            <p className="text-xl font-semibold">{privilegeRows.length}</p>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-200">Facility workflows</p>
            <p className="text-xl font-semibold">{credentials.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border p-4 lg:col-span-2">
          <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs uppercase">
            <ShieldCheck className="size-4" /> State licenses
          </p>
          {licenseRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No state licenses found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="py-1 pr-3">State</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1 pr-3">Number</th>
                    <th className="py-1 pr-3">Starts</th>
                    <th className="py-1">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {licenseRows.map((license) => (
                    <tr key={license.id} className="border-t">
                      <td className="py-1 pr-3">{license.state ?? "—"}</td>
                      <td className="py-1 pr-3">{license.status ?? "—"}</td>
                      <td className="py-1 pr-3">{license.number ?? "—"}</td>
                      <td className="py-1 pr-3">{formatDate(license.startsAt)}</td>
                      <td className={`py-1 ${getLicenseStatusTone(license.expiresAt)}`}>
                        {formatDate(license.expiresAt)}
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
            <CalendarClock className="size-4" /> Provider details
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt>Created</dt>
              <dd>{formatDate(provider.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Updated</dt>
              <dd>{formatDate(provider.updatedAt)}</dd>
            </div>
            <div className="border-t pt-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{provider.notes ?? "—"}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs uppercase">
          <Activity className="size-4" /> Vesta privileges history
        </p>
        {privilegeRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Vesta privilege records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="py-1 pr-3">Tier</th>
                  <th className="py-1 pr-3">Init date</th>
                  <th className="py-1 pr-3">Exp date</th>
                  <th className="py-1 pr-3">Term date</th>
                  <th className="py-1">Term reason</th>
                </tr>
              </thead>
              <tbody>
                {privilegeRows.map((privilege) => (
                  <tr key={privilege.id} className="border-t">
                    <td className="py-1 pr-3">
                      <Badge className={`bg-transparent ${getPrivilegeTone(privilege.privilegeTier)}`} variant="outline">
                        {privilege.privilegeTier ?? "Unspecified"}
                      </Badge>
                    </td>
                    <td className="py-1 pr-3">{formatDate(privilege.currentPrivInitDate)}</td>
                    <td className={`py-1 pr-3 ${getLicenseStatusTone(privilege.currentPrivEndDate)}`}>
                      {formatDate(privilege.currentPrivEndDate)}
                    </td>
                    <td className="py-1 pr-3">{formatDate(privilege.termDate)}</td>
                    <td className="py-1">{privilege.termReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-muted-foreground flex items-center gap-2 text-xs uppercase">
          <Building2 className="size-4" /> Sub-workflows by facility
        </p>
        {credentials.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No provider facility credentials exist for this provider.
          </div>
        ) : (
          credentials.map((credential) => {
            const workflowList = workflowsByCredential.get(credential.id) ?? [];
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
                    <h2 className="text-lg font-semibold">{credential.facilityName ?? "Unknown facility"}</h2>
                    <p className="text-muted-foreground text-sm">
                      Priority: {credential.priority ?? "—"} · Decision: {credential.decision ?? "—"}
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
                            <td className={`py-1 pr-3 ${getLicenseStatusTone(workflow.dueDate)}`}>
                              {workflow.dueDate ?? "—"}
                            </td>
                            <td className="py-1 pr-3">{workflow.completedAt ?? "—"}</td>
                            <td className="py-1">
                              <WorkflowPhaseDrawer
                                timeline={workflowList}
                                updateAction={updateWorkflowPhaseAction}
                                workflow={{
                                  ...workflow,
                                  facilityName: credential.facilityName ?? "Unknown facility",
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

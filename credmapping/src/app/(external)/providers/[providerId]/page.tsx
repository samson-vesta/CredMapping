import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { ActivityTimeline } from "~/components/audit-log/ActivityTimeline";
import {
  EditProviderDialog,
  DeleteProviderDialog,
} from "~/components/providers/provider-actions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CollapsibleSection } from "~/components/ui/collapsible-section";
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
  if (days < 0) return "text-red-600 dark:text-red-400";
  if (days <= 90) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const getPrivilegeTone = (tier: string | null) => {
  const normalized = tier?.toLowerCase() ?? "";
  if (normalized.includes("inactive"))
    return "border-zinc-500/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  if (normalized.includes("progress"))
    return "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (normalized.includes("temp"))
    return "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (normalized.includes("full"))
    return "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
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

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-xl border   p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
              <Stethoscope className="size-4" /> Provider profile
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{formatName(provider)}</h1>
            <p className="text-muted-foreground text-sm">{provider.email ?? "No email"} · {provider.phone ?? "No phone"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EditProviderDialog provider={provider} />
            <DeleteProviderDialog providerId={provider.id} providerName={formatName(provider)} />
            <Button asChild variant="outline">
              <Link href="/providers">Back to providers</Link>
            </Button>
          </div>
        </div>

        {/* Inline details */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Created {formatDate(provider.createdAt)}</span>
          <span>·</span>
          <span>Updated {formatDate(provider.updatedAt)}</span>
          {provider.notes && (
            <>
              <span>·</span>
              <span className="max-w-xs truncate" title={provider.notes}>{provider.notes}</span>
            </>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">State licenses</p>
            <p className="text-xl font-semibold">{licenseRows.length}</p>
          </div>
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">Privilege records</p>
            <p className="text-xl font-semibold">{privilegeRows.length}</p>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">Facility workflows</p>
            <p className="text-xl font-semibold">{credentials.length}</p>
          </div>
        </div>
      </section>

      {/* ── State licenses ────────────────────────────────────── */}
      <CollapsibleSection
        title={<span className="flex items-center gap-2"><ShieldCheck className="size-4" /> State licenses</span>}
        badge={licenseRows.length}
        maxHeight="20rem"
      >
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
                  <th className="py-1 pr-3">Expires</th>
                </tr>
              </thead>
              <tbody>
                {licenseRows.map((license) => (
                  <tr key={license.id} className="border-t">
                    <td className="py-1 pr-3">{license.state ?? "—"}</td>
                    <td className="py-1 pr-3">{license.status ?? "—"}</td>
                    <td className="py-1 pr-3">{license.number ?? "—"}</td>
                    <td className="py-1 pr-3">{formatDate(license.startsAt)}</td>
                    <td className={`py-1 pr-3 ${getLicenseStatusTone(license.expiresAt)}`}>
                      {formatDate(license.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Vesta privileges ────────────────────────────────── */}
      <CollapsibleSection
        title={<span className="flex items-center gap-2"><Activity className="size-4" /> Vesta privileges history</span>}
        badge={privilegeRows.length}
        maxHeight="20rem"
      >
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
                  <th className="py-1 pr-3">Term reason</th>
                </tr>
              </thead>
              <tbody>
                {privilegeRows.map((privilege) => (
                  <tr key={privilege.id} className="border-t">
                    <td className="py-1 pr-3">
                      <Badge className={`${getPrivilegeTone(privilege.privilegeTier)}`} variant="outline">
                        {privilege.privilegeTier ?? "Unspecified"}
                      </Badge>
                    </td>
                    <td className="py-1 pr-3">{formatDate(privilege.currentPrivInitDate)}</td>
                    <td className={`py-1 pr-3 ${getLicenseStatusTone(privilege.currentPrivEndDate)}`}>
                      {formatDate(privilege.currentPrivEndDate)}
                    </td>
                    <td className="py-1 pr-3">{formatDate(privilege.termDate)}</td>
                    <td className="py-1 pr-3">{privilege.termReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Sub-workflows by facility ─────────────────────── */}
      <CollapsibleSection
        title={<span className="flex items-center gap-2"><Building2 className="size-4" /> Sub-workflows by facility</span>}
        badge={credentials.length}
        maxHeight="32rem"
      >
        {credentials.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No provider facility credentials exist for this provider.
          </p>
        ) : (
          <div className="space-y-2">
            {credentials.map((credential) => {
              const workflowList = workflowsByCredential.get(credential.id) ?? [];
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
                    <h3 className="text-sm font-semibold leading-tight">{credential.facilityName ?? "Unknown facility"}</h3>
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0">{credential.priority ?? "—"}</Badge>
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0">{credential.decision ?? "—"}</Badge>
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
                              <td className={`py-1 pr-3 ${getLicenseStatusTone(workflow.dueDate)}`}>
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
        <ActivityTimeline entityType="provider" entityId={providerId} />
      </CollapsibleSection>
    </div>
  );
}

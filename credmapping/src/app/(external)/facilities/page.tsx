import { and, count, desc, eq, ilike, inArray, not, or, sql } from "drizzle-orm";
import { Mail, Phone } from "lucide-react";
import { AddFacilityDialog } from "~/components/facilities/add-facility-dialog";
import { MetricsTrendChart } from "~/components/metrics-trend-chart";
import { ProvidersAutoAdvance } from "~/components/providers-auto-advance";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { VirtualScrollContainer } from "~/components/ui/virtual-scroll-container";
import { getAppRole } from "~/server/auth/domain";
import { db } from "~/server/db";
import {
  agents,
  facilities,
  facilityContacts,
  providerFacilityCredentials,
  providers,
  workflowPhases,
} from "~/server/db/schema";
import { createClient } from "~/utils/supabase/server";

const formatDate = (value: Date | string | null) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const sanitizePhoneForHref = (value: string) => value.replace(/[^\d+]/g, "");

type FacilityStatus = NonNullable<(typeof facilities.$inferSelect)["status"]>;

const getFacilityStatusTone = (status: FacilityStatus | null) => {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "inactive") return "border-l-4 border-l-zinc-500";
  if (normalized === "in progress") return "border-l-4 border-l-blue-500";
  return "border-l-4 border-l-emerald-500";
};

type FacilitySort = "name_asc" | "name_desc" | "updated_desc" | "updated_asc";
type ContactsFilter = "all" | "with" | "without";
type ActivityFilter = "all" | "active" | "inactive" | "in_progress";

const isFacilitySort = (value: string): value is FacilitySort =>
  ["name_asc", "name_desc", "updated_desc", "updated_asc"].includes(value);

const isContactsFilter = (value: string): value is ContactsFilter =>
  ["all", "with", "without"].includes(value);

const isActivityFilter = (value: string): value is ActivityFilter =>
  ["all", "active", "inactive", "in_progress"].includes(value);

export default async function FacilitiesPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const agentRoleRow = user
    ? await db
        .select({ role: agents.role })
        .from(agents)
        .where(eq(agents.userId, user.id))
        .limit(1)
    : [];

  const isSuperAdmin = getAppRole({ agentRole: agentRoleRow[0]?.role }) === "superadmin";

  const searchParams = await props.searchParams;

  const search = typeof searchParams?.search === "string" ? searchParams.search.trim() : "";
  const hasSearch = search.length > 0;

  const rawSort = typeof searchParams?.sort === "string" ? searchParams.sort : "";
  const sort: FacilitySort = isFacilitySort(rawSort) ? rawSort : "name_asc";

  const rawContacts = typeof searchParams?.contacts === "string" ? searchParams.contacts : "all";
  const contactsFilter: ContactsFilter = isContactsFilter(rawContacts) ? rawContacts : "all";

  const rawActivity = typeof searchParams?.activity === "string" ? searchParams.activity : "all";
  const activityFilter: ActivityFilter = isActivityFilter(rawActivity) ? rawActivity : "all";

  const pageSize = 10;
  const rawLimit = typeof searchParams?.limit === "string" ? searchParams.limit : `${pageSize}`;
  const requestedLimit = Number.isFinite(Number(rawLimit))
    ? Math.max(pageSize, Number.parseInt(rawLimit, 10) || pageSize)
    : pageSize;

  const [contactFacilityRows, facilityCreatedRows, credentialCreatedRows, workflowIncidentRows] =
    await Promise.all([
      db.selectDistinct({ facilityId: facilityContacts.facilityId }).from(facilityContacts),
    db.select({ createdAt: facilities.createdAt }).from(facilities),
    db.select({ createdAt: providerFacilityCredentials.createdAt }).from(providerFacilityCredentials),
    db
      .select({ createdAt: workflowPhases.createdAt })
      .from(workflowPhases)
      .where(eq(workflowPhases.workflowType, "pfc")),
  ]);

  const facilityTimeline = new Map<string, { primary: number; secondary: number; tertiary: number }>();

  const addToTimeline = (
    dateValue: Date | string | null,
    metric: "primary" | "secondary" | "tertiary",
  ) => {
    if (!dateValue) return;
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const current = facilityTimeline.get(key) ?? { primary: 0, secondary: 0, tertiary: 0 };
    current[metric] += 1;
    facilityTimeline.set(key, current);
  };

  for (const row of facilityCreatedRows) addToTimeline(row.createdAt, "primary");
  for (const row of credentialCreatedRows) addToTimeline(row.createdAt, "secondary");
  for (const row of workflowIncidentRows) addToTimeline(row.createdAt, "tertiary");

  const facilityTrendPoints = Array.from(facilityTimeline.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({ date, ...values }));

  const facilitiesWithContacts = contactFacilityRows
    .map((row) => row.facilityId)
    .filter((id): id is string => Boolean(id));

  const searchWhere = hasSearch
    ? or(
        ilike(facilities.name, `%${search}%`),
        ilike(facilities.state, `%${search}%`),
        ilike(facilities.email, `%${search}%`),
        ilike(facilities.address, `%${search}%`),
        ilike(facilities.proxy, `%${search}%`),
      )
    : undefined;

  const activityWhere =
    activityFilter === "all"
      ? undefined
      : eq(
          facilities.status,
          activityFilter === "active"
            ? "Active"
            : activityFilter === "inactive"
              ? "Inactive"
              : "In Progress",
        );

  const contactsWhere =
    contactsFilter === "all"
      ? undefined
      : contactsFilter === "with"
        ? facilitiesWithContacts.length > 0
          ? inArray(facilities.id, facilitiesWithContacts)
          : sql`1 = 0`
        : facilitiesWithContacts.length > 0
          ? not(inArray(facilities.id, facilitiesWithContacts))
          : undefined;

  const whereClause = and(searchWhere, activityWhere, contactsWhere);

  const totalVisibleRow = await db.select({ count: count() }).from(facilities).where(whereClause);

  const orderByClause =
    sort === "name_desc"
      ? [desc(facilities.name), desc(facilities.updatedAt)]
      : sort === "updated_desc"
        ? [desc(facilities.updatedAt), desc(facilities.name)]
        : sort === "updated_asc"
          ? [facilities.updatedAt, facilities.name]
          : [facilities.name, desc(facilities.updatedAt)];

  const visibleLimit = Math.min(requestedLimit, totalVisibleRow[0]?.count ?? 0);

  const facilityRows = await db
    .select()
    .from(facilities)
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(visibleLimit);

  const facilityIds = facilityRows.map((row) => row.id);

  const [contactRows, credentialRows] =
    facilityIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(facilityContacts)
            .where(inArray(facilityContacts.facilityId, facilityIds))
            .orderBy(desc(facilityContacts.isPrimary), facilityContacts.name),
          db
            .select()
            .from(providerFacilityCredentials)
            .where(inArray(providerFacilityCredentials.facilityId, facilityIds))
            .orderBy(desc(providerFacilityCredentials.updatedAt)),
        ])
      : [[], []];

  const providerIds = credentialRows
    .map((credential) => credential.providerId)
    .filter((id): id is string => Boolean(id));

  const providerRows =
    providerIds.length > 0
      ? await db
          .select({
            id: providers.id,
            firstName: providers.firstName,
            middleName: providers.middleName,
            lastName: providers.lastName,
            degree: providers.degree,
          })
          .from(providers)
          .where(inArray(providers.id, providerIds))
      : [];

  const credentialIds = credentialRows.map((credential) => credential.id);

  const workflowRows =
    credentialIds.length > 0
      ? await db
          .select()
          .from(workflowPhases)
          .where(and(eq(workflowPhases.workflowType, "pfc"), inArray(workflowPhases.relatedId, credentialIds)))
          .orderBy(desc(workflowPhases.updatedAt))
      : [];

  const contactsByFacility = new Map<string, typeof contactRows>();
  for (const contact of contactRows) {
    const current = contactsByFacility.get(contact.facilityId) ?? [];
    current.push(contact);
    contactsByFacility.set(contact.facilityId, current);
  }

  const credentialsByFacility = new Map<string, typeof credentialRows>();
  for (const credential of credentialRows) {
    if (!credential.facilityId) continue;
    const current = credentialsByFacility.get(credential.facilityId) ?? [];
    current.push(credential);
    credentialsByFacility.set(credential.facilityId, current);
  }

  const providersById = new Map(providerRows.map((provider) => [provider.id, provider]));

  const workflowsByCredential = new Map<string, typeof workflowRows>();
  for (const workflow of workflowRows) {
    const current = workflowsByCredential.get(workflow.relatedId) ?? [];
    current.push(workflow);
    workflowsByCredential.set(workflow.relatedId, current);
  }

  const facilityCards = facilityRows.map((facility) => {
    const facilityContactsRows = contactsByFacility.get(facility.id) ?? [];
    const facilityCredentialRows = credentialsByFacility.get(facility.id) ?? [];

    const workflowCount = facilityCredentialRows.reduce(
      (sum, credential) => sum + (workflowsByCredential.get(credential.id)?.length ?? 0),
      0,
    );

    return {
      facility,
      contacts: facilityContactsRows,
      credentials: facilityCredentialRows,
      workflowCount,
      primaryContact:
        facilityContactsRows.find((contact) => contact.isPrimary) ?? facilityContactsRows[0] ?? null,
    };
  });

  const hasMoreFacilities = visibleLimit < (totalVisibleRow[0]?.count ?? 0);
  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (sort !== "name_asc") queryParams.set("sort", sort);
  if (contactsFilter !== "all") queryParams.set("contacts", contactsFilter);
  if (activityFilter !== "all") queryParams.set("activity", activityFilter);

  const createLimitHref = (nextLimit: number) => {
    const nextParams = new URLSearchParams(queryParams);
    if (nextLimit > pageSize) nextParams.set("limit", String(nextLimit));
    const query = nextParams.toString();
    return `/facilities${query ? `?${query}` : ""}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <MetricsTrendChart
        labels={{
          primary: "New facilities",
          secondary: "New PFC links",
          tertiary: "Related incidents",
        }}
        points={facilityTrendPoints}
        title="Facility onboarding velocity"
      />

      <form className="bg-card flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-end" method="get">
        <div className="grid flex-1 gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase">Sort facilities</span>
            <select className="bg-background h-9 w-full rounded-md border px-3 text-sm" defaultValue={sort} name="sort">
              <option value="name_asc">Facility name (A → Z)</option>
              <option value="name_desc">Facility name (Z → A)</option>
              <option value="updated_desc">Updated (newest first)</option>
              <option value="updated_asc">Updated (oldest first)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase">Activity</span>
            <select className="bg-background h-9 w-full rounded-md border px-3 text-sm" defaultValue={activityFilter} name="activity">
              <option value="all">All facilities</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="in_progress">In progress only</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase">Contact coverage</span>
            <select
              className="bg-background h-9 w-full rounded-md border px-3 text-sm"
              defaultValue={contactsFilter}
              name="contacts"
            >
              <option value="all">All facilities</option>
              <option value="with">With contacts</option>
              <option value="without">Without contacts</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground text-xs uppercase">Search facilities</span>
            <input
              className="bg-background h-9 w-full rounded-md border px-3 text-sm"
              defaultValue={search}
              name="search"
              placeholder="Search by name, state, email, address"
              type="search"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline">
            Apply
          </Button>
          <Button asChild variant="outline">
            <a href="/facilities">Reset</a>
          </Button>
          {isSuperAdmin ? <AddFacilityDialog /> : null}
        </div>
      </form>

      {facilityCards.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-sm">
          No facilities found.
        </div>
      ) : (
        <VirtualScrollContainer
          className="min-h-0 flex-1"
          heightClassName="h-full"
          viewportClassName="facilities-scroll-viewport"
        >
          <div className="space-y-4 p-4">
            {facilityCards.map((card) => {
              const { facility, contacts, credentials, primaryContact, workflowCount } = card;
              const primaryPhoneHref = primaryContact?.phone
                ? sanitizePhoneForHref(primaryContact.phone)
                : "";
              const providerCount = new Set(
                credentials.map((credential) => credential.providerId).filter(Boolean),
              ).size;
              const statusTone = getFacilityStatusTone(facility.status ?? null);

              return (
                <section key={facility.id} className={`bg-card rounded-lg border ${statusTone}`}>
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 border-b p-4 [&::-webkit-details-marker]:hidden">
                      <div className="flex min-h-9 items-center gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">{facility.name ?? "Unnamed Facility"}</h2>
                          <p className="text-muted-foreground text-sm">
                            {facility.state ?? "—"} {facility.proxy ? `• Proxy: ${facility.proxy}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="text-muted-foreground space-y-2 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {primaryContact?.email ? (
                            <a
                              className="text-foreground underline-offset-4 transition hover:underline"
                              href={`mailto:${primaryContact.email}`}
                            >
                              {primaryContact.email}
                            </a>
                          ) : (
                            <p>No facility contact email</p>
                          )}
                          <Mail className="text-muted-foreground size-4" />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          {primaryContact?.phone && primaryPhoneHref ? (
                            <a
                              className="text-foreground underline-offset-4 transition hover:underline"
                              href={`tel:${primaryPhoneHref}`}
                            >
                              {primaryContact.phone}
                            </a>
                          ) : (
                            <p>No facility contact phone</p>
                          )}
                          <Phone className="text-muted-foreground size-4" />
                        </div>
                      </div>
                    </summary>

                    <div className="grid gap-4 p-4 lg:grid-cols-4">
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground text-xs uppercase">General</p>
                        <dl className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between gap-2">
                            <dt>Status</dt>
                            <dd>
                              {facility.status ?? "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Yearly volume</dt>
                            <dd>{facility.yearlyVolume?.toLocaleString() ?? "—"}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>TAT SLA</dt>
                            <dd>{facility.tatSla ?? "—"}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Created</dt>
                            <dd>{formatDate(facility.createdAt)}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Updated</dt>
                            <dd>{formatDate(facility.updatedAt)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-md border p-3 lg:col-span-2">
                        <p className="text-muted-foreground text-xs uppercase">Contact directory</p>
                        {contacts.length === 0 ? (
                          <p className="text-muted-foreground mt-2 text-sm">No contacts linked.</p>
                        ) : (
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-muted-foreground text-xs uppercase">
                                <tr>
                                  <th className="py-1 pr-3">name</th>
                                  <th className="py-1 pr-3">title</th>
                                  <th className="py-1 pr-3">email</th>
                                  <th className="py-1 pr-3">phone</th>
                                </tr>
                              </thead>
                              <tbody>
                                {contacts.map((contact) => (
                                  <tr key={contact.id} className="border-t">
                                    <td className="py-1 pr-3">
                                      {contact.name}
                                      {contact.isPrimary ? (
                                        <Badge className="ml-2" variant="outline">
                                          Primary
                                        </Badge>
                                      ) : null}
                                    </td>
                                    <td className="py-1 pr-3">{contact.title ?? "—"}</td>
                                    <td className="py-1 pr-3">{contact.email ?? "—"}</td>
                                    <td className="py-1 pr-3">{contact.phone ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground text-xs uppercase">Operational profile</p>
                        <dl className="mt-2 space-y-2 text-sm">
                          <div>
                            <dt className="text-muted-foreground">Address</dt>
                            <dd>{facility.address ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Modalities</dt>
                            <dd>{facility.modalities?.join(", ") ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Linked providers</dt>
                            <dd>{providerCount}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">PFC workflows</dt>
                            <dd>{workflowCount}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-md border p-3 lg:col-span-4">
                        <p className="text-muted-foreground text-xs uppercase">Linked PFC records</p>
                        {credentials.length === 0 ? (
                          <p className="text-muted-foreground mt-2 text-sm">No linked PFC records.</p>
                        ) : (
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-muted-foreground text-xs uppercase">
                                <tr>
                                  <th className="py-1 pr-3">provider</th>
                                  <th className="py-1 pr-3">facility type</th>
                                  <th className="py-1 pr-3">priority</th>
                                  <th className="py-1 pr-3">decision</th>
                                  <th className="py-1 pr-3">updated</th>
                                </tr>
                              </thead>
                              <tbody>
                                {credentials.map((credential) => {
                                  const provider = credential.providerId
                                    ? providersById.get(credential.providerId)
                                    : null;
                                  const providerName = provider
                                    ? [provider.firstName, provider.middleName, provider.lastName]
                                        .filter(Boolean)
                                        .join(" ") ?? "Unnamed Provider"
                                    : "Unlinked";
                                  const displayProviderName = provider?.degree
                                    ? `${providerName}, ${provider.degree}`
                                    : providerName;

                                  return (
                                    <tr key={credential.id} className="border-t">
                                      <td className="py-1 pr-3">{displayProviderName}</td>
                                      <td className="py-1 pr-3">{credential.facilityType ?? "—"}</td>
                                      <td className="py-1 pr-3">{credential.priority ?? "—"}</td>
                                      <td className="py-1 pr-3">{credential.decision ?? "—"}</td>
                                      <td className="py-1 pr-3">{formatDate(credential.updatedAt)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                </section>
              );
            })}

            <div className="border-t pt-3 text-sm">
              <p className="text-muted-foreground">
                Showing {facilityCards.length} of {totalVisibleRow[0]?.count ?? 0} facilities
              </p>
            </div>

            <ProvidersAutoAdvance
              enabled={hasMoreFacilities}
              nextHref={createLimitHref(
                Math.min(requestedLimit + pageSize, totalVisibleRow[0]?.count ?? 0),
              )}
              rootSelector=".facilities-scroll-viewport"
            />
          </div>
        </VirtualScrollContainer>
      )}
    </div>
  );
}

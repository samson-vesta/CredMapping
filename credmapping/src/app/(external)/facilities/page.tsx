import { desc, ilike, or, count, eq, sql, isNotNull, inArray } from "drizzle-orm";

import { db } from "~/server/db";
import { facilities, facilityContacts } from "~/server/db/schema";
import { FacilitiesClient } from "./facilities-client";

export default async function FacilitiesPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const rawSearch = searchParams?.search;
  const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
  const hasSearch = search.length >= 2;

  const rawPage = searchParams?.page;
  const page = typeof rawPage === "string" ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;

  const rawSize = searchParams?.size;
  const pageSize =
    typeof rawSize === "string"
      ? Math.min(50, Math.max(5, parseInt(rawSize, 10) || 15))
      : 15;

  const rawActive = searchParams?.active;
  const activeOnly = rawActive === "true";

  const rawContactsFilter = searchParams?.contacts;
  const contactsFilter = typeof rawContactsFilter === "string" ? rawContactsFilter : "all";

  // Build where conditions
  const buildWhereConditions = () => {
    const conditions = [];
    if (hasSearch) {
      conditions.push(
        or(
          ilike(facilities.name, `%${search}%`),
          ilike(facilities.state, `%${search}%`),
          ilike(facilities.email, `%${search}%`),
          ilike(facilities.address, `%${search}%`),
          ilike(facilities.proxy, `%${search}%`),
        ),
      );
    }
    if (activeOnly) {
      conditions.push(eq(facilities.active, true));
    }
    return conditions.filter(Boolean);
  };

  // Get facilities with/without contacts if filter is applied
  let contactFilterIds: string[] | null = null;
  if (contactsFilter === "with" || contactsFilter === "without") {
    const allFacilityIds = await db.select({ id: facilities.id }).from(facilities);
    const facilitiesWithContactsResult = await db
      .selectDistinct({ facilityId: facilityContacts.facilityId })
      .from(facilityContacts);
    
    const withContactsSet = new Set(facilitiesWithContactsResult.map(r => r.facilityId));
    
    if (contactsFilter === "with") {
      contactFilterIds = Array.from(withContactsSet);
    } else {
      contactFilterIds = allFacilityIds
        .map(f => f.id)
        .filter(id => !withContactsSet.has(id));
    }
    
    // If no facilities match the contact filter, return empty result
    if (contactFilterIds.length === 0) {
      return (
        <FacilitiesClient
          facilities={[]}
          total={0}
          page={1}
          pageSize={pageSize}
          totalPages={0}
          search={search}
          activeOnly={activeOnly}
          contactsFilter={contactsFilter}
        />
      );
    }
  }

  // Build final where clause
  const buildFinalWhere = () => {
    const conditions = buildWhereConditions();
    if (contactFilterIds) {
      conditions.push(inArray(facilities.id, contactFilterIds));
    }
    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    // Combine with AND
    return sql`${conditions.map((c, i) => i === 0 ? c : sql`AND ${c}`).reduce((a, b) => sql`${a} ${b}`)}`;
  };

  const whereClause = buildFinalWhere();

  // Parallel: total count + page of data
  const [totalResult, facilityRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(facilities)
      .where(whereClause),
    db
      .select()
      .from(facilities)
      .where(whereClause)
      .orderBy(desc(facilities.updatedAt), desc(facilities.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Fetch contacts for every facility on this page
  const facilityIds = facilityRows.map((f) => f.id);
  const contactRows =
    facilityIds.length > 0
      ? await db
          .select()
          .from(facilityContacts)
          .where(
            or(...facilityIds.map((id) => eq(facilityContacts.facilityId, id))),
          )
      : [];

  // Group contacts by facilityId
  const contactsByFacility = new Map<string, typeof contactRows>();
  for (const c of contactRows) {
    const list = contactsByFacility.get(c.facilityId) ?? [];
    list.push(c);
    contactsByFacility.set(c.facilityId, list);
  }

  const facilitiesWithContacts = facilityRows.map((f) => ({
    ...f,
    createdAt: f.createdAt?.toISOString() ?? null,
    updatedAt: f.updatedAt?.toISOString() ?? null,
    contacts: (contactsByFacility.get(f.id) ?? []).map((c) => ({
      ...c,
      createdAt: c.createdAt?.toISOString() ?? null,
      updatedAt: c.updatedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <FacilitiesClient
      facilities={facilitiesWithContacts}
      total={total}
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
      search={search}
      activeOnly={activeOnly}
      contactsFilter={contactsFilter}
    />
  );
}

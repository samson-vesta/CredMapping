import { desc, eq } from "drizzle-orm";
import { DashboardClient } from "~/app/(external)/dashboard/dashboard-client";
import { db } from "~/server/db";
import {
  facilities,
  facilityPreliveInfo,
  providerFacilityCredentials,
  providerStateLicenses,
  providers,
  providerVestaPrivileges
} from "~/server/db/schema";

const formatProviderName = (provider: {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  degree: string | null;
}) => {
  const firstAndMiddle = [provider.firstName, provider.middleName]
    .filter(Boolean)
    .join(" ");
  const fullName = provider.lastName
    ? firstAndMiddle
      ? `${provider.lastName}, ${firstAndMiddle}`
      : provider.lastName
    : firstAndMiddle;

  if (!fullName) return "Unnamed Provider";

  return fullName;
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

export default async function DashboardPage() {
  const [providerFacilityRowsRaw, facilityPreliveRowsRaw, providerLicenseRowsRaw, providerVestaPrivilegesRowsRaw] =
    await Promise.all([
      db
        .select({
          id: providerFacilityCredentials.id,
          providerId: providerFacilityCredentials.providerId,
          providerFirstName: providers.firstName,
          providerMiddleName: providers.middleName,
          providerLastName: providers.lastName,
          providerDegree: providers.degree,
          facilityId: providerFacilityCredentials.facilityId,
          facilityName: facilities.name,
          facilityState: facilities.state,
          priority: providerFacilityCredentials.priority,
          privileges: providerFacilityCredentials.privileges,
          decision: providerFacilityCredentials.decision,
          facilityType: providerFacilityCredentials.facilityType,
          applicationRequired: providerFacilityCredentials.applicationRequired,
          updatedAt: providerFacilityCredentials.updatedAt,
        })
        .from(providerFacilityCredentials)
        .leftJoin(providers, eq(providerFacilityCredentials.providerId, providers.id))
        .leftJoin(facilities, eq(providerFacilityCredentials.facilityId, facilities.id))
        .orderBy(desc(providerFacilityCredentials.updatedAt)),
      db
        .select({
          id: facilityPreliveInfo.id,
          facilityId: facilityPreliveInfo.facilityId,
          facilityName: facilities.name,
          facilityState: facilities.state,
          priority: facilityPreliveInfo.priority,
          goLiveDate: facilityPreliveInfo.goLiveDate,
          credentialingDueDate: facilityPreliveInfo.credentialingDueDate,
          boardMeetingDate: facilityPreliveInfo.boardMeetingDate,
          tempsPossible: facilityPreliveInfo.tempsPossible,
          payorEnrollmentRequired: facilityPreliveInfo.payorEnrollmentRequired,
          rolesNeeded: facilityPreliveInfo.rolesNeeded,
          updatedAt: facilityPreliveInfo.updatedAt,
        })
        .from(facilityPreliveInfo)
        .leftJoin(facilities, eq(facilityPreliveInfo.facilityId, facilities.id))
        .orderBy(desc(facilityPreliveInfo.updatedAt)),
      db
        .select({
          id: providerStateLicenses.id,
          providerId: providerStateLicenses.providerId,
          providerFirstName: providers.firstName,
          providerMiddleName: providers.middleName,
          providerLastName: providers.lastName,
          providerDegree: providers.degree,
          state: providerStateLicenses.state,
          priority: providerStateLicenses.priority,
          status: providerStateLicenses.status,
          path: providerStateLicenses.path,
          initialOrRenewal: providerStateLicenses.initialOrRenewal,
          startsAt: providerStateLicenses.startsAt,
          expiresAt: providerStateLicenses.expiresAt,
          updatedAt: providerStateLicenses.updatedAt,
        })
        .from(providerStateLicenses)
        .leftJoin(providers, eq(providerStateLicenses.providerId, providers.id))
        .orderBy(desc(providerStateLicenses.updatedAt)),
      db
        .select({
          id: providerVestaPrivileges.id,
          providerId: providerVestaPrivileges.providerId,
          providerFirstName: providers.firstName,
          providerMiddleName: providers.middleName,
          providerLastName: providers.lastName,
          providerDegree: providers.degree,
          privilegeTier: providerVestaPrivileges.privilegeTier,
          currentPrivInitDate: providerVestaPrivileges.currentPrivInitDate,
          currentPrivEndDate: providerVestaPrivileges.currentPrivEndDate,
          termDate: providerVestaPrivileges.termDate,
          termReason: providerVestaPrivileges.termReason,
          pastPrivileges: providerVestaPrivileges.pastPrivileges,
          updatedAt: providerVestaPrivileges.updatedAt,
        })
        .from(providerVestaPrivileges)
        .leftJoin(providers, eq(providerVestaPrivileges.providerId, providers.id))
        .orderBy(desc(providerVestaPrivileges.updatedAt)),
    ]);

  const providerFacilityRows = providerFacilityRowsRaw.map((row) => ({
    id: row.id,
    providerId: row.providerId,
    providerName: formatProviderName({
      firstName: row.providerFirstName,
      middleName: row.providerMiddleName,
      lastName: row.providerLastName,
      degree: row.providerDegree,
    }),
    providerDegree: row.providerDegree,
    facilityId: row.facilityId,
    facilityName: row.facilityName ?? "Unnamed Facility",
    facilityState: row.facilityState,
    priority: row.priority,
    privileges: row.privileges,
    decision: row.decision,
    facilityType: row.facilityType,
    applicationRequired: row.applicationRequired,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));

  const facilityPreliveRows = facilityPreliveRowsRaw.map((row) => ({
    id: row.id,
    facilityId: row.facilityId,
    facilityName: row.facilityName ?? "Unnamed Facility",
    facilityState: row.facilityState,
    priority: row.priority,
    goLiveDate: row.goLiveDate,
    credentialingDueDate: row.credentialingDueDate,
    boardMeetingDate: row.boardMeetingDate,
    tempsPossible: row.tempsPossible,
    payorEnrollmentRequired: row.payorEnrollmentRequired,
    rolesNeeded: parseRoles(row.rolesNeeded),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));

  const providerLicenseRows = providerLicenseRowsRaw.map((row) => ({
    id: row.id,
    providerId: row.providerId,
    providerName: formatProviderName({
      firstName: row.providerFirstName,
      middleName: row.providerMiddleName,
      lastName: row.providerLastName,
      degree: row.providerDegree,
    }),
    providerDegree: row.providerDegree,
    state: row.state,
    priority: row.priority,
    status: row.status,
    path: row.path,
    initialOrRenewal: row.initialOrRenewal,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));

  const providerVestaPrivilegesRows = providerVestaPrivilegesRowsRaw.map((row) => ({
    id: row.id,
    providerId: row.providerId,
    providerName: formatProviderName({
      firstName: row.providerFirstName,
      middleName: row.providerMiddleName,
      lastName: row.providerLastName,
      degree: row.providerDegree,
    }),
    providerDegree: row.providerDegree,
    privilegeTier: row.privilegeTier,
    currentPrivInitDate: row.currentPrivInitDate,
    currentPrivEndDate: row.currentPrivEndDate,
    termDate: row.termDate,
    termReason: row.termReason,
    pastPrivileges: row.pastPrivileges as { approved_at: string; expires_at: string; tier?: string }[] | null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <DashboardClient
        providerFacilityRows={providerFacilityRows}
        facilityPreliveRows={facilityPreliveRows}
        providerLicenseRows={providerLicenseRows}
        providerVestaPrivilegesRows={providerVestaPrivilegesRows}
      />
    </div>
  );
}

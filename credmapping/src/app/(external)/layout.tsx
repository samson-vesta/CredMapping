import { AppShell } from "~/components/layout/app-shell";
import { eq } from "drizzle-orm";

import { requireRequestAuthContext } from "~/server/auth/request-context";
import { withUserDb } from "~/server/db";
import { facilities, providers } from "~/server/db/schema";

export default async function ExternalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ facilityId?: string; providerId?: string }>;
}) {
  const { facilityId, providerId } = await params;
  const { user } = await requireRequestAuthContext();

  const breadcrumbLabels =
    providerId || facilityId
      ? await withUserDb({
          user,
          run: async (db) => {
            const [providerRow, facilityRow] = await Promise.all([
              providerId
                ? db
                    .select({
                      degree: providers.degree,
                      firstName: providers.firstName,
                      lastName: providers.lastName,
                      middleName: providers.middleName,
                    })
                    .from(providers)
                    .where(eq(providers.id, providerId))
                    .limit(1)
                : Promise.resolve([]),
              facilityId
                ? db
                    .select({ name: facilities.name })
                    .from(facilities)
                    .where(eq(facilities.id, facilityId))
                    .limit(1)
                : Promise.resolve([]),
            ]);

            const provider = providerRow[0];
            const facility = facilityRow[0];
            const providerLabel = provider
              ? [provider.firstName, provider.middleName, provider.lastName]
                  .filter(Boolean)
                  .join(" ") || "Provider Profile"
              : undefined;

            return {
              facilities: facility?.name ?? undefined,
              providers:
                providerLabel && provider?.degree
                  ? `${providerLabel}, ${provider.degree}`
                  : providerLabel,
            };
          },
        })
      : undefined;

  return <AppShell breadcrumbLabels={breadcrumbLabels}>{children}</AppShell>;
}

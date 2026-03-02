import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { commLogs, facilities, providers } from "~/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { withRls } from "~/server/db";

const trimAndNormalize = (value: string) => value.trim().replace(/\s+/g, " ");

const buildProviderName = (provider: {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  degree: string | null;
}) => {
  const fullName = [provider.firstName, provider.middleName, provider.lastName]
    .filter(Boolean)
    .join(" ");

  if (!fullName) {
    return "Unnamed Provider";
  }

  return provider.degree ? `${fullName}, ${provider.degree}` : fullName;
};

export const searchRouter = createTRPCRouter({
  global: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(2).max(100),
        limitPerType: z.number().int().min(1).max(20).default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query = trimAndNormalize(input.query);
      const likeQuery = `%${query}%`;

      const [
        providerRows,
        facilityRows,
        providerCommLogRows,
        facilityCommLogRows,
      ] = await withRls({
        jwtClaims: {
          sub: ctx.user.id,
          email: ctx.user.email?.toLowerCase() ?? "",
          role: "authenticated",
        },
        run: async (tx) => {
          const providersPromise = tx
            .select({
              id: providers.id,
              firstName: providers.firstName,
              middleName: providers.middleName,
              lastName: providers.lastName,
              degree: providers.degree,
              email: providers.email,
            })
            .from(providers)
            .where(
              or(
                ilike(providers.firstName, likeQuery),
                ilike(providers.middleName, likeQuery),
                ilike(providers.lastName, likeQuery),
                ilike(providers.email, likeQuery),
                ilike(providers.notes, likeQuery),
              ),
            )
            .limit(input.limitPerType);

          const facilitiesPromise = tx
            .select({
              id: facilities.id,
              name: facilities.name,
              state: facilities.state,
              email: facilities.email,
            })
            .from(facilities)
            .where(
              or(
                ilike(facilities.name, likeQuery),
                ilike(facilities.state, likeQuery),
                ilike(facilities.email, likeQuery),
                ilike(facilities.address, likeQuery),
                ilike(facilities.proxy, likeQuery),
              ),
            )
            .limit(input.limitPerType);

          const providerCommLogRowsPromise = tx
            .select({
              id: commLogs.id,
              relatedId: commLogs.relatedId,
              providerFirstName: providers.firstName,
              providerMiddleName: providers.middleName,
              providerLastName: providers.lastName,
              providerDegree: providers.degree,
              subject: commLogs.subject,
              commType: commLogs.commType,
            })
            .from(commLogs)
            .leftJoin(providers, eq(commLogs.relatedId, providers.id))
            .where(
              and(
                eq(commLogs.relatedType, "provider"),
                or(
                  ilike(commLogs.subject, likeQuery),
                  ilike(commLogs.notes, likeQuery),
                  ilike(commLogs.commType, likeQuery),
                  ilike(providers.firstName, likeQuery),
                  ilike(providers.middleName, likeQuery),
                  ilike(providers.lastName, likeQuery),
                ),
              ),
            )
            .limit(input.limitPerType);

          const facilityCommLogRowsPromise = tx
            .select({
              id: commLogs.id,
              relatedId: commLogs.relatedId,
              facilityName: facilities.name,
              subject: commLogs.subject,
              commType: commLogs.commType,
            })
            .from(commLogs)
            .leftJoin(facilities, eq(commLogs.relatedId, facilities.id))
            .where(
              and(
                eq(commLogs.relatedType, "facility"),
                or(
                  ilike(commLogs.subject, likeQuery),
                  ilike(commLogs.notes, likeQuery),
                  ilike(commLogs.commType, likeQuery),
                  ilike(facilities.name, likeQuery),
                  ilike(facilities.state, likeQuery),
                ),
              ),
            )
            .limit(input.limitPerType);

          return Promise.all([
            providersPromise,
            facilitiesPromise,
            providerCommLogRowsPromise,
            facilityCommLogRowsPromise,
          ]);
        },
      });

      return {
        query,
        providers: providerRows.map((provider) => ({
          id: provider.id,
          name: buildProviderName(provider),
          subtitle: provider.email,
          href: `/providers/${provider.id}`,
        })),
        facilities: facilityRows.map((facility) => ({
          id: facility.id,
          name: facility.name?.trim() ?? "Unnamed Facility",
          subtitle:
            [facility.state, facility.email].filter(Boolean).join(" • ") ||
            null,
          href: `/facilities/${facility.id}`,
        })),
        providerCommLogs: providerCommLogRows
          .filter((log) => log.relatedId)
          .map((log) => ({
            id: log.id,
            name: buildProviderName({
              firstName: log.providerFirstName,
              middleName: log.providerMiddleName,
              lastName: log.providerLastName,
              degree: log.providerDegree,
            }),
            subtitle:
              [log.subject, log.commType]
                .filter(Boolean)
                .join(" • ") || "View communication logs",
            href: `/comm-logs?mode=provider&id=${log.relatedId}`,
          })),
        facilityCommLogs: facilityCommLogRows
          .filter((log) => log.relatedId)
          .map((log) => ({
            id: log.id,
            name: log.facilityName?.trim() ?? "Unnamed Facility",
            subtitle:
              [log.subject, log.commType]
                .filter(Boolean)
                .join(" • ") || "View communication logs",
            href: `/comm-logs?mode=facility&id=${log.relatedId}`,
          })),
      };
    }),
});

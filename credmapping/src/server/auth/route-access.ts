import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import { getAppRole, type AppRole } from "~/server/auth/domain";
import { db } from "~/server/db";
import { agents } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Single source of truth: route prefix → allowed roles.
 * Keep this in sync with the sidebar items in sidebar.tsx.
 */
export const routeRoles: Record<string, AppRole[]> = {
  "/admin": ["superadmin"],
  "/workflows": ["admin", "superadmin"],
  // /dashboard, /agents, /facilities → all roles (no entry needed)
};

/**
 * Server-side guard. Call from a route's layout.tsx to enforce role access.
 * Redirects to /dashboard if the user's role is not allowed.
 *
 * Usage in a layout.tsx:
 *   import { requireRole } from "~/server/auth/route-access";
 *   export default async function Layout({ children }) {
 *     await requireRole(["superadmin"]);
 *     return <>{children}</>;
 *   }
 */
export async function requireRole(allowedRoles: AppRole[]): Promise<AppRole> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const normalizedEmail = user.email?.toLowerCase();

  const agentRecord = normalizedEmail
    ? await db
        .select({ role: agents.role })
        .from(agents)
        .where(eq(sql`lower(${agents.email})`, normalizedEmail))
        .limit(1)
    : [];

  const userRole = getAppRole({ agentRole: agentRecord[0]?.role });

  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard");
  }

  return userRole;
}

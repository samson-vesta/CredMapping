import { redirect } from "next/navigation";
import { type AppRole } from "~/server/auth/domain";
import { requireRequestAuthContext } from "~/server/auth/request-context";

/**
 * Single source of truth: route prefix → allowed roles.
 * Keep this in sync with the sidebar items in sidebar.tsx.
 */
export const routeRoles: Record<string, AppRole[]> = {
  "/agent-management": ["superadmin"],
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
  const { appRole: userRole } = await requireRequestAuthContext();

  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard");
  }

  return userRole;
}

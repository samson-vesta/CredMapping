
import { requireRole } from "~/server/auth/route-access";

export default async function AuditLogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["admin", "superadmin"]);
  return <>{children}</>;
}


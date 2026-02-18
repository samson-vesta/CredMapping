import { requireRole } from "~/server/auth/route-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["superadmin"]);
  return <>{children}</>;
}

import { requireRole } from "~/server/auth/route-access";

export default async function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["admin", "superadmin"]);
  return <>{children}</>;
}

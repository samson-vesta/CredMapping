import { AppShell } from "~/components/layout/app-shell";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}

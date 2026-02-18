import { AppShell } from "~/components/layout/app-shell";

export default async function ExternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}

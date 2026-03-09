import { cookies } from "next/headers";
import { Header } from "~/components/layout/header";
import { Sidebar } from "~/components/layout/sidebar";
import { requireRequestAuthContext } from "~/server/auth/request-context";

type SidebarMode = "expanded" | "collapsed" | "hover";

function parseSidebarMode(value: string | undefined): SidebarMode {
  if (value === "collapsed" || value === "hover") {
    return value;
  }

  return "expanded";
}

export async function AppShell({
  breadcrumbLabels,
  children,
}: {
  breadcrumbLabels?: Partial<Record<"facilities" | "providers", string>>;
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const { appRole: userRole, user } = await requireRequestAuthContext();
  const initialSidebarMode = parseSidebarMode(
    cookieStore.get("sidebar-mode")?.value
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header
        breadcrumbLabels={breadcrumbLabels}
        user={user}
        userRole={userRole}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar userRole={userRole} initialSidebarMode={initialSidebarMode} />

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

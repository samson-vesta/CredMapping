import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { Header } from "~/components/layout/header";
import { Sidebar } from "~/components/layout/sidebar";
import { getAppRole } from "~/server/auth/domain";
import { db } from "~/server/db";
import { agents } from "~/server/db/schema";
import { createClient } from "~/utils/supabase/server";

type SidebarMode = "expanded" | "collapsed" | "hover";

function parseSidebarMode(value: string | undefined): SidebarMode {
  if (value === "collapsed" || value === "hover") {
    return value;
  }

  return "expanded";
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/");

  const agentRecord = await db
    .select({ role: agents.role })
    .from(agents)
    .where(eq(agents.userId, user.id))
    .limit(1);

  const dbRole = agentRecord[0]?.role;

  const userRole = getAppRole({ agentRole: dbRole });
  const initialSidebarMode = parseSidebarMode(
    cookieStore.get("sidebar-mode")?.value
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header user={user} userRole={userRole} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar userRole={userRole} initialSidebarMode={initialSidebarMode} />

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

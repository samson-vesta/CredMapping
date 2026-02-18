import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Header } from "~/components/layout/header";
import { Sidebar } from "~/components/layout/sidebar";
import { getAppRole } from "~/server/auth/domain";
import { db } from "~/server/db";
import { agents } from "~/server/db/schema";
import { createClient } from "~/utils/supabase/server";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar userRole={userRole} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

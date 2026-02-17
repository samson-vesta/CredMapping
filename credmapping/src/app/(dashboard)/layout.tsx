import { Sidebar } from "~/components/layout/sidebar";
import { Header } from "~/components/layout/header";
import { createClient } from "~/utils/supabase/server";
import { getAppRole } from "~/server/auth/domain";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { agents } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/");

  const normalizedEmail = user.email?.toLowerCase();
  
  const agentRecord = normalizedEmail 
    ? await db
        .select({ role: agents.role })
        .from(agents)
        .where(eq(sql`lower(${agents.email})`, normalizedEmail))
        .limit(1)
    : [];

  const dbRole = agentRecord[0]?.role;

  const userRole = getAppRole({ agentRole: dbRole });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar userRole={userRole} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={user} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
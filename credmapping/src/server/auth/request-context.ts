import { type User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAppRole, isAllowedEmail, type AppRole } from "~/server/auth/domain";
import { withUserDb } from "~/server/db";
import { agents } from "~/server/db/schema";
import { createClient } from "~/utils/supabase/server";

type AuthContextResult = {
  appRole: AppRole;
  user: User | null;
};

export const resolveAuthContextForUser = async (
  user: User | null,
): Promise<AuthContextResult> => {
  const authenticatedUser = user && isAllowedEmail(user.email) ? user : null;

  if (!authenticatedUser) {
    return {
      appRole: "user",
      user: null,
    };
  }

  const [agent] = await withUserDb({
    user: authenticatedUser,
    run: (db) =>
      db
        .select({ role: agents.role })
        .from(agents)
        .where(eq(agents.userId, authenticatedUser.id))
        .limit(1),
  });

  return {
    appRole: getAppRole({ agentRole: agent?.role }),
    user: authenticatedUser,
  };
};

export const getRequestAuthContext = cache(async (): Promise<AuthContextResult> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return resolveAuthContextForUser(error ? null : user);
});

export const requireRequestAuthContext = async (): Promise<{
  appRole: AppRole;
  user: User;
}> => {
  const authContext = await getRequestAuthContext();

  if (!authContext.user) {
    redirect("/");
  }

  return authContext as { appRole: AppRole; user: User };
};

import { type NextRequest, NextResponse } from "next/server";

import { getAppRole, isAllowedEmail } from "~/server/auth/domain";
import { createClient } from "~/utils/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNextPath = requestUrl.searchParams.get("next");
  const nextPath =
    rawNextPath && rawNextPath.startsWith("/") && !rawNextPath.startsWith("//")
      ? rawNextPath
      : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/?error=oauth_callback_failed", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/?error=oauth_callback_failed", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/?error=domain_not_allowed", request.url));
  }

  const appRole = getAppRole({
    email: user.email,
    metadataRole: user.user_metadata?.app_role,
  });

  await supabase.auth.updateUser({
    data: {
      app_role: appRole,
    },
  });

  return NextResponse.redirect(new URL(nextPath, request.url));
}

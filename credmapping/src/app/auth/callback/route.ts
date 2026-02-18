import { type NextRequest, NextResponse } from "next/server";

import { isAllowedEmail } from "~/server/auth/domain";
import { createClient } from "~/utils/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNextPath = requestUrl.searchParams.get("next");
  const nextPath =
    rawNextPath && rawNextPath.startsWith("/") && !rawNextPath.startsWith("//")
      ? rawNextPath
      : "/";

  const forwardedHostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProtoHeader = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const forwardedHost = forwardedHostHeader?.split(",")[0]?.trim();
  const forwardedProto = forwardedProtoHeader?.split(",")[0]?.trim();
  const baseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/?error=oauth_callback_failed", baseUrl));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/?error=oauth_callback_failed", baseUrl));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/?error=domain_not_allowed", baseUrl));
  }


  return NextResponse.redirect(new URL(nextPath, baseUrl));
}

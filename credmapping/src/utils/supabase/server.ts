import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "~/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // `cookies()` is read-only in Server Components.
            // Ignore write failures here and rely on middleware to refresh cookies.
          }
        },
      },
    },
  );
};

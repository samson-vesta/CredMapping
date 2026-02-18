import { SignInButton, SignOutButton } from "~/components/auth-buttons";
import { getAppRole } from "~/server/auth/domain";
import { createClient } from "~/utils/supabase/server";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  domain_not_allowed:
    "Access is restricted to @vestasolutions.com and @vestatelemed.com accounts.",
  oauth_callback_failed: "Google sign-in failed. Please try again.",
};

export default async function Home(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const errorParam = searchParams?.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appRole = getAppRole({
    agentRole: "user",
  });

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-6">      
      <section className="flex w-full max-w-sm flex-col items-center space-y-12">
      
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold shadow-sm">
              C+
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              CredMapping+
            </h1>
          </div>
        </div>

        {error && (
          <div className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {errorMessages[error] ?? "Authentication error."}
          </div>
        )}

        <div className="flex w-full flex-col items-center gap-8">
          {!user ? (
            <div className="flex flex-col items-center gap-4">
              <SignInButton />
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-6">
              {/* This section is just kept for development purposes to see the user information */}
              <div className="w-full space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <span className="font-medium capitalize">{appRole}</span>
                </div>
              </div>
              
              <div className="flex w-full flex-col gap-3">
                <Link 
                  href="/dashboard" 
                  className="flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Go to Dashboard
                </Link>
                <SignOutButton />
              </div>
            </div>
          )}
        </div>

        <footer className="absolute bottom-8 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          Vesta Solutions &copy; {new Date().getFullYear()}
        </footer>
      </section>
    </main>
  );
}
import { SignInButton } from "~/components/auth-buttons";
import { createClient } from "~/utils/supabase/server";
import { redirect } from "next/navigation";

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

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
      <section className="flex w-full max-w-sm flex-col items-center space-y-12">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground shadow-sm">
              C+
            </div>
            <h1 className="text-4xl font-bold tracking-tight">CredMapping+</h1>
          </div>
        </div>

        {error && (
          <div className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {errorMessages[error] ?? "Authentication error."}
          </div>
        )}

        <div className="flex w-full flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <SignInButton />
          </div>
        </div>

        <footer className="absolute bottom-8 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          Vesta Solutions &copy; {new Date().getFullYear()}
        </footer>
      </section>
    </main>
  );
}

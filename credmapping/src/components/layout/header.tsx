"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, User, Monitor } from "lucide-react";
import { createClient } from "~/utils/supabase/client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { GlobalSearch } from "~/components/layout/global-search";

import { type User as UserType } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, useTransition } from "react";

function formatSegmentLabel(segment: string) {
  const decodedSegment = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();

  return decodedSegment
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const isLikelyUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function Header({ user }: { user: UserType }) {
  const [isPending, startTransition] = useTransition();
  const [providerBreadcrumbLabel, setProviderBreadcrumbLabel] = useState<string | null>(null);

  const pathname = usePathname();
  const segments = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);

  useEffect(() => {
    const providerId = segments[0] === "providers" ? segments[1] : undefined;

    if (!providerId || !isLikelyUuid(providerId)) {
      setProviderBreadcrumbLabel(null);
      return;
    }

    let mounted = true;
    void fetch(`/api/providers/${providerId}/breadcrumb`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("label" in data)) return null;
        const label = data.label;
        return typeof label === "string" ? label : null;
      })
      .then((label) => {
        if (!mounted) return;
        setProviderBreadcrumbLabel(label);
      })
      .catch(() => {
        if (!mounted) return;
        setProviderBreadcrumbLabel(null);
      });

    return () => {
      mounted = false;
    };
  }, [segments]);

  const breadcrumbItems = segments.map((segment, index) => {
    const isProviderProfileSegment = index === 1 && segments[0] === "providers" && isLikelyUuid(segment);

    const label = isProviderProfileSegment
      ? providerBreadcrumbLabel ?? "Provider Profile"
      : formatSegmentLabel(segment);

    return {
      href: `/${segments.slice(0, index + 1).join("/")}`,
      label,
      isCurrent: index === segments.length - 1,
    };
  });

  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: "light", label: "Set light theme", icon: Sun },
    { value: "dark", label: "Set dark theme", icon: Moon },
    { value: "system", label: "Set system theme", icon: Monitor },
  ] as const;

  const handleSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    });
  };

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "User";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center border-b bg-muted/30 px-5">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(20rem,40rem)_minmax(0,1fr)] items-center gap-4">
        <div className="-ml-1 flex min-w-0 items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold text-primary">
            <Image src="/logo.png" alt="CredMapping+ logo" width={25} height={32} priority />
          </Link>
          <span className="mx-2 h-6 w-px shrink-0 bg-border" aria-hidden="true" />

          <nav className="flex min-w-0 items-center gap-2 text-sm font-medium" aria-label="Breadcrumb">
            {breadcrumbItems.length === 0 ? (
              <Link
                href="/dashboard"
                aria-current="page"
                className="truncate text-foreground transition-colors hover:text-foreground/90 hover:underline underline-offset-4"
              >
                Dashboard
              </Link>
            ) : (
              breadcrumbItems.map((item) => (
                <React.Fragment key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.isCurrent ? "page" : undefined}
                    className={`truncate transition-colors hover:text-foreground hover:underline underline-offset-4 ${
                      item.isCurrent ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                  {!item.isCurrent && <span className="text-muted-foreground/50">/</span>}
                </React.Fragment>
              ))
            )}
          </nav>
        </div>

        <div className="w-full">
          <GlobalSearch />
        </div>

        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar className="h-9 w-9 border transition-opacity hover:opacity-80">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {fullName.charAt(0).toUpperCase() ?? <User size={18} />}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-28 min-w-0">
              <DropdownMenuLabel className="font-normal">
                <div className="flex w-full flex-col space-y-1">
                  <p className="flex items-center justify-center truncate text-sm font-medium leading-none">
                    {fullName.split(" ")[0]}
                  </p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <div className="flex items-center justify-center gap-1 px-1 py-1">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = theme === option.value;

                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`size-8 justify-center rounded-md border p-0 ${
                        isActive
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-transparent text-muted-foreground"
                      }`}
                      aria-label={option.label}
                    >
                      <Icon size={14} />
                    </DropdownMenuItem>
                  );
                })}
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleSignOut}
                onSelect={(e) => e.preventDefault()}
                disabled={isPending}
                className="mx-auto w-24 cursor-pointer justify-center gap-2 truncate text-destructive focus:text-destructive"
              >
                <LogOut size={16} />
                {isPending ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

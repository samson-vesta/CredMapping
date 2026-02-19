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
import { useTransition } from "react";

function formatSegmentLabel(segment: string) {
  const decodedSegment = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();

  return decodedSegment
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Header({ user }: { user: UserType }) {
  const [isPending, startTransition] = useTransition();

  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join("/")}`,
    label: formatSegmentLabel(segment),
    isCurrent: index === segments.length - 1,
  }));

  const { setTheme } = useTheme();

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
          <span className="h-6 w-px shrink-0 bg-border mx-2" aria-hidden="true" />

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

            <DropdownMenuContent align="end" className="w-30 min-w-0">
              <DropdownMenuLabel className="font-normal">
                <div className="flex w-full flex-col space-y-1">
                  <p className="truncate text-sm font-medium leading-none">{fullName.split(" ")[0]}</p>
                  <p className="truncate text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <div className="flex items-center justify-center gap-1 px-1 py-1">
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className="size-8 justify-center rounded-md p-0"
                  aria-label="Set light theme"
                >
                  <Sun size={14} />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="size-8 justify-center rounded-md p-0"
                  aria-label="Set dark theme"
                >
                  <Moon size={14} />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="size-8 justify-center rounded-md p-0"
                  aria-label="Set system theme"
                >
                  <Monitor size={14} />
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleSignOut}
                onSelect={(e) => e.preventDefault()}
                disabled={isPending}
                className="mx-auto w-28 cursor-pointer justify-center gap-2 text-destructive focus:text-destructive"
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

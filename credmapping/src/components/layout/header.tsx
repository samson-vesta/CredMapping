"use client";

import * as React from "react";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { GlobalSearch } from "~/components/layout/global-search";

import { type User as UserType } from "@supabase/supabase-js";
import { useTransition } from "react";

const routeLabels: Record<string, string> = {
  agents: "Management",
  facilities: "Management",
  workflows: "System",
  admin: "Admin",
};

export function Header({ user }: { user: UserType }) {
  const [isPending, startTransition] = useTransition();

  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

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
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b bg-background px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-medium">
        {segments.length === 0 ? (
          <span className="text-foreground">Overview</span>
        ) : (
          <>
            {routeLabels[segments[0] ?? ""] && (
              <>
                <span className="text-muted-foreground">{routeLabels[segments[0] ?? ""]}</span>
                <span className="text-muted-foreground/50">/</span>
              </>
            )}
            
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1;
              const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

              return (
                <div key={segment} className="flex items-center gap-2">
                  <span className={isLast ? "text-foreground" : "text-muted-foreground"}>
                    {label}
                  </span>
                  {!isLast && <span className="text-muted-foreground/50">/</span>}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl mx-12">
        <div className="relative group">
          <GlobalSearch />
        </div>
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <Avatar className="h-9 w-9 border hover:opacity-80 transition-opacity">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {fullName.charAt(0).toUpperCase() ?? <User size={18} />}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{fullName}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span>Appearance</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
                    <Sun size={14} /> Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
                    <Moon size={14} /> Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
                    <Monitor size={14} /> System
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleSignOut}
              onSelect={(e) => e.preventDefault()}
              disabled={isPending}
              className="text-destructive focus:text-destructive gap-2 cursor-pointer"
            >
              <LogOut size={16} />
              {isPending ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
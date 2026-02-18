"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Workflow, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

// Current sidebar items I could think of with role requirement assumptions. We can easily add more and change the roles as needed. For now, I just have it so if you're an admin you see everything, and if you're a user you see everything except workflows and admin panel. We can also easily change it so that the admin panel is only visible to a "super admin" role or something like that.
const sidebarItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard, roles: ["user", "admin"] },
  { name: "Agents", href: "/agents", icon: Users, roles: ["user", "admin"] },
  { name: "Facilities", href: "/facilities", icon: Building2, roles: ["user", "admin"] },
  { name: "Workflows", href: "/workflows", icon: Workflow, roles: ["admin"] },
  { name: "Admin Panel", href: "/admin", icon: ShieldCheck, roles: ["admin"] },
];

interface SidebarProps {
  userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
if (saved) setIsCollapsed(JSON.parse(saved) as boolean);
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const nextState = !prev;
      localStorage.setItem("sidebar-collapsed", JSON.stringify(nextState));
      return nextState;
    });
  };

  const filteredNav = sidebarItems.filter(item => item.roles.includes(userRole));

  return (
    <aside 
      className={`relative flex flex-col border-r bg-muted/30 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b overflow-hidden">
        <div className="flex items-center gap-3 font-semibold text-primary">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            C+
          </div>
          <span className={`truncate tracking-tight text-lg transition-all duration-200 ${
            isCollapsed ? "opacity-0 w-0 invisible" : "opacity-100 w-auto visible"
          }`}>
            CredMapping+
          </span>
        </div>
      </div>

      {/* Sidebar Items */}
      <nav className="flex-1 space-y-2 p-2 mt-4 overflow-hidden">
        {!mounted ? (
          // Skeleton while loading, can be replaced with better skeleton later if wanted
          <div className="space-y-2 px-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-full bg-muted/60 animate-pulse rounded-md" />
            ))}
          </div>
        ) : (
          filteredNav.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <Tooltip key={`${item.href}-${isCollapsed}`} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                      isActive 
                        ? "bg-secondary text-secondary-foreground" 
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className={`whitespace-nowrap transition-all duration-200 ${
                      isCollapsed ? "opacity-0 w-0 invisible" : "opacity-100 w-auto visible"
                    }`}>
                      {item.name}
                    </span>
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" sideOffset={10} className="font-medium">
                    {item.name}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })
        )}
      </nav>

      {/* Collapse Button */}
      <div className="border-t p-2 overflow-hidden">
        <Button
          variant="ghost"
          className={`w-full justify-start gap-3 transition-all ${isCollapsed ? "px-0 justify-center" : ""}`}
          onClick={toggleSidebar}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span className={`transition-all duration-200 ${
                isCollapsed ? "opacity-0 w-0 invisible" : "opacity-100 w-auto visible delay-200"
              }`}>
                Collapse sidebar
              </span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
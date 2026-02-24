"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseMedical,
  Building2,
  FileText,
  LayoutDashboard,
  Mail,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const sidebarItems = [
  // External
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["user", "admin", "superadmin"],
  },
  {
    name: "Facilities",
    href: "/facilities",
    icon: Building2,
    roles: ["user", "admin", "superadmin"],
  },
  {
    name: "Providers",
    href: "/providers",
    icon: BriefcaseMedical,
    roles: ["user", "admin", "superadmin"],
  },
  {
    name: "Comm Logs",
    href: "/comm-logs",
    icon: Mail,
    roles: ["user", "admin", "superadmin"],
  },
  // Internal
  {
    name: "Workflows",
    href: "/workflows",
    icon: Workflow,
    roles: ["admin", "superadmin"],
  },
  {
    name: "Agent Management",
    href: "/agent-management",
    icon: ShieldCheck,
    roles: ["superadmin"],
  },
  {
    name: "Audit Log",
    href: "/audit-log",
    icon: FileText,
    roles: ["admin", "superadmin"],
  },
];

const SIDEBAR_MODE_KEY = "sidebar-mode";
const SIDEBAR_MODE_COOKIE = "sidebar-mode";
const SIDEBAR_MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
type SidebarMode = "expanded" | "collapsed" | "hover";

interface SidebarProps {
  userRole: string;
  initialSidebarMode: SidebarMode;
}

export function Sidebar({ userRole, initialSidebarMode }: SidebarProps) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(initialSidebarMode);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const savedMode = localStorage.getItem(SIDEBAR_MODE_KEY) as
      | SidebarMode
      | null;

    if (savedMode === "expanded" || savedMode === "collapsed" || savedMode === "hover") {
      setSidebarMode(savedMode);
    } else {
      // Backward compatibility with previous boolean key.
      const legacyCollapsed = localStorage.getItem("sidebar-collapsed");
      if (legacyCollapsed !== null) {
        setSidebarMode(JSON.parse(legacyCollapsed) ? "collapsed" : "expanded");
      }
    }

    setMounted(true);
  }, []);

  const setMode = (mode: SidebarMode) => {
    setSidebarMode(mode);
    localStorage.setItem(SIDEBAR_MODE_KEY, mode);
    document.cookie = `${SIDEBAR_MODE_COOKIE}=${mode}; path=/; max-age=${SIDEBAR_MODE_COOKIE_MAX_AGE_SECONDS}`;
  };

  const isCollapsed =
    sidebarMode === "collapsed" ||
    (sidebarMode === "hover" && !isHoveringSidebar);

  const filteredNav = sidebarItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside
      onMouseEnter={() => setIsHoveringSidebar(true)}
      onMouseLeave={() => setIsHoveringSidebar(false)}
      className={`relative flex h-full flex-col border-r bg-muted/30 duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <nav className="mt-4 flex-1 space-y-2 overflow-hidden p-2">
        {!mounted ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        ) : (
          filteredNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

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
                    <span
                      className={`whitespace-nowrap transition-all duration-200 ${
                        isCollapsed ? "invisible w-0 opacity-0" : "visible w-auto opacity-100"
                      }`}
                    >
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

      {mounted && (
        <div className="overflow-hidden border-t p-2">
          <DropdownMenu>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                  >
                    <Settings2 className="h-5 w-5 shrink-0" />
                    <span
                      className={`whitespace-nowrap transition-all duration-200 ${
                        isCollapsed ? "invisible w-0 opacity-0" : "visible w-auto opacity-100"
                      }`}
                    >
                      Sidebar control
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Sidebar control</TooltipContent>}
            </Tooltip>

            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuLabel>Sidebar control</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sidebarMode}
                onValueChange={(value) => setMode(value as SidebarMode)}
              >
                <DropdownMenuRadioItem value="expanded">Expanded</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="collapsed">Collapsed</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="hover">Expand on hover</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}

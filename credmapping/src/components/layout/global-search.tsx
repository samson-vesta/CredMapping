"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Building2, LayoutDashboard, Clock } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";

interface SearchItem {
  name: string;
  href: string;
}

export function GlobalSearch() {
  const [open, setOpen] =  useState(false);
  const [recent, setRecent] = useState<SearchItem[]>([]);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("recent-searches");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SearchItem[];
        setRecent(parsed);
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }
  }, []);

  const navigateTo = (name: string, href: string) => {
    const newRecent = [{ name, href }, ...recent.filter((i) => i.href !== href)].slice(0, 3);
    setRecent(newRecent);
    localStorage.setItem("recent-searches", JSON.stringify(newRecent));
    
    setOpen(false);
    router.push(href);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          onFocus={() => setOpen(true)}
          placeholder="Search resources, docs, and more"
          className="w-full h-10 pl-10 pr-4 rounded-md bg-muted/50 border border-transparent focus:bg-background focus:border-input focus:ring-1 focus:ring-ring outline-none transition-all text-sm"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 border bg-popover text-popover-foreground shadow-xl rounded-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <Command className="rounded-none border-none">
            <CommandList className="max-h-100">
              <CommandEmpty>No results found.</CommandEmpty>
              
              {/* Recent Searches */}
              {recent.length > 0 && (
                <CommandGroup heading="Recent searches">
                  {recent.map((item) => (
                    <CommandItem key={item.href} onSelect={() => navigateTo(item.name, item.href)}>
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />

              <CommandGroup heading="Pages">
                <CommandItem onSelect={() => navigateTo("Overview", "/")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Overview</span>
                </CommandItem>
                <CommandItem onSelect={() => navigateTo("Agents", "/agents")}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Agents</span>
                </CommandItem>
                <CommandItem onSelect={() => navigateTo("Facilities", "/facilities")}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>Facilities</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
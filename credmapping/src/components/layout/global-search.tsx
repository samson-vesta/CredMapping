"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseMedical,
  Building2,
  Clock,
  LayoutDashboard,
  LoaderCircle,
  Search,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import { api } from "~/trpc/react";

interface SearchItem {
  name: string;
  href: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<SearchItem[]>([]);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const hasSearchQuery = query.trim().length >= 2;

  const { data, isFetching } = api.search.global.useQuery(
    { query: query.trim(), limitPerType: 6 },
    {
      enabled: open && hasSearchQuery,
      staleTime: 30_000,
    },
  );

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
    const newRecent = [{ name, href }, ...recent.filter((i) => i.href !== href)].slice(0, 5);
    setRecent(newRecent);
    localStorage.setItem("recent-searches", JSON.stringify(newRecent));

    setOpen(false);
    setQuery("");
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

  const hasProviderResults = (data?.providers.length ?? 0) > 0;
  const hasFacilityResults = (data?.facilities.length ?? 0) > 0;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search providers, facilities, and more"
          className="w-full h-10 pl-10 pr-4 rounded-md bg-muted/50 border border-transparent focus:bg-background focus:border-input focus:ring-1 focus:ring-ring outline-none transition-all text-sm"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 border bg-popover text-popover-foreground shadow-xl rounded-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <Command shouldFilter={false} className="rounded-none border-none">
            <CommandList className="max-h-100">
              {!hasSearchQuery ? (
                <CommandEmpty>Type at least 2 characters to search the platform.</CommandEmpty>
              ) : isFetching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" /> Searching...
                </div>
              ) : !hasProviderResults && !hasFacilityResults ? (
                <CommandEmpty>No matches found.</CommandEmpty>
              ) : null}

              {hasProviderResults && (
                <CommandGroup heading="Providers">
                  {data?.providers.map((provider) => (
                    <CommandItem
                      key={provider.id}
                      value={`${provider.name} ${provider.subtitle ?? ""}`}
                      onSelect={() => navigateTo(provider.name, provider.href)}
                    >
                      <BriefcaseMedical className="mr-2 h-4 w-4" />
                      <div className="min-w-0">
                        <p className="truncate">{provider.name}</p>
                        {provider.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{provider.subtitle}</p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {hasFacilityResults && (
                <CommandGroup heading="Facilities">
                  {data?.facilities.map((facility) => (
                    <CommandItem
                      key={facility.id}
                      value={`${facility.name} ${facility.subtitle ?? ""}`}
                      onSelect={() => navigateTo(facility.name, facility.href)}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <div className="min-w-0">
                        <p className="truncate">{facility.name}</p>
                        {facility.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{facility.subtitle}</p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />

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

              <CommandGroup heading="Pages">
                <CommandItem onSelect={() => navigateTo("Overview", "/")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Overview</span>
                </CommandItem>
                <CommandItem onSelect={() => navigateTo("Providers", "/providers")}>
                  <BriefcaseMedical className="mr-2 h-4 w-4" />
                  <span>Providers</span>
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

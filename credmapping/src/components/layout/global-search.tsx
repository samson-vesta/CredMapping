"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseMedical,
  Building2,
  Clock,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareText,
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
    const newRecent = [
      { name, href },
      ...recent.filter((i) => i.href !== href),
    ].slice(0, 5);
    setRecent(newRecent);
    localStorage.setItem("recent-searches", JSON.stringify(newRecent));

    setOpen(false);
    setQuery("");
    router.push(href);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasProviderResults = (data?.providers.length ?? 0) > 0;
  const hasFacilityResults = (data?.facilities.length ?? 0) > 0;
  const hasProviderCommLogResults = (data?.providerCommLogs.length ?? 0) > 0;
  const hasFacilityCommLogResults = (data?.facilityCommLogs.length ?? 0) > 0;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="group relative">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          size={18}
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search providers, facilities, and more"
          className="bg-muted/50 focus:bg-background focus:border-input focus:ring-ring h-10 w-full rounded-md border border-transparent pr-4 pl-10 text-sm placeholder:text-center transition-all outline-none focus:ring-1"
        />
      </div>

      {open && (
        <div className="bg-popover text-popover-foreground animate-in fade-in zoom-in-95 absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border shadow-xl duration-100">
          <Command shouldFilter={false} className="rounded-none border-none">
            <CommandList className="max-h-100">
              {!hasSearchQuery ? (
                <CommandEmpty>
                  Type at least 2 characters to search the platform.
                </CommandEmpty>
              ) : isFetching ? (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
                  <LoaderCircle className="size-4 animate-spin" /> Searching...
                </div>
              ) : !hasProviderResults &&
                !hasFacilityResults &&
                !hasProviderCommLogResults &&
                !hasFacilityCommLogResults ? (
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
                          <p className="text-muted-foreground truncate text-xs">
                            {provider.subtitle}
                          </p>
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
                          <p className="text-muted-foreground truncate text-xs">
                            {facility.subtitle}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {hasProviderCommLogResults && (
                <CommandGroup heading="Provider comm logs">
                  {data?.providerCommLogs.map((providerLog) => (
                    <CommandItem
                      key={providerLog.id}
                      value={`${providerLog.name} ${providerLog.subtitle ?? ""}`}
                      onSelect={() =>
                        navigateTo(
                          `${providerLog.name} (Comm Logs)`,
                          providerLog.href,
                        )
                      }
                    >
                      <MessageSquareText className="mr-2 h-4 w-4" />
                      <div className="min-w-0">
                        <p className="truncate">{providerLog.name}</p>
                        {providerLog.subtitle && (
                          <p className="text-muted-foreground truncate text-xs">
                            {providerLog.subtitle}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {hasFacilityCommLogResults && (
                <CommandGroup heading="Facility comm logs">
                  {data?.facilityCommLogs.map((facilityLog) => (
                    <CommandItem
                      key={facilityLog.id}
                      value={`${facilityLog.name} ${facilityLog.subtitle ?? ""}`}
                      onSelect={() =>
                        navigateTo(
                          `${facilityLog.name} (Comm Logs)`,
                          facilityLog.href,
                        )
                      }
                    >
                      <MessageSquareText className="mr-2 h-4 w-4" />
                      <div className="min-w-0">
                        <p className="truncate">{facilityLog.name}</p>
                        {facilityLog.subtitle && (
                          <p className="text-muted-foreground truncate text-xs">
                            {facilityLog.subtitle}
                          </p>
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
                    <CommandItem
                      key={item.href}
                      onSelect={() => navigateTo(item.name, item.href)}
                    >
                      <Clock className="text-muted-foreground mr-2 h-4 w-4" />
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
                <CommandItem
                  onSelect={() => navigateTo("Providers", "/providers")}
                >
                  <BriefcaseMedical className="mr-2 h-4 w-4" />
                  <span>Providers</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => navigateTo("Facilities", "/facilities")}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>Facilities</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => navigateTo("Comm Logs", "/comm-logs")}
                >
                  <MessageSquareText className="mr-2 h-4 w-4" />
                  <span>Comm Logs</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

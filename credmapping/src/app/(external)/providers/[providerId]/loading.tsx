export default function LoadingProviderProfile() {
  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      {/* Hero / back button skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded-md bg-muted/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border p-3">
            <div className="mb-2 h-3 w-24 animate-pulse rounded bg-muted/60" />
            <div className="h-6 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Details card */}
        <div className="rounded-lg border p-4">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted/60" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
                <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </div>

        {/* Licenses table */}
        <div className="rounded-lg border p-4 lg:col-span-2">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted/60" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-12 animate-pulse rounded bg-muted/40" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Privileges section */}
      <div className="rounded-lg border p-4">
        <div className="mb-3 h-4 w-36 animate-pulse rounded bg-muted/60" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted/60" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-muted/60" />
            <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Table / content skeleton */}
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="divide-y">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="h-4 w-4 animate-pulse rounded bg-muted/40" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

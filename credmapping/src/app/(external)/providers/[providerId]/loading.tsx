function SkeletonSection({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
          <div className="h-5 w-8 animate-pulse rounded-full bg-muted/40" />
        </div>
        <div className="h-4 w-4 animate-pulse rounded bg-muted/30" />
      </div>
      <div className="border-t px-4 pb-4 pt-3 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted/40" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoadingProviderProfile() {
  return (
    <div className="animate-in fade-in-0 duration-300 space-y-4">
      {/* Hero header skeleton */}
      <div className="rounded-xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-muted/40" />
            <div className="h-7 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-44 animate-pulse rounded bg-muted/50" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-md border p-3">
              <div className="mb-2 h-3 w-24 animate-pulse rounded bg-muted/60" />
              <div className="h-6 w-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4">
          <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted/30" />
        </div>
      </div>

      {/* State licenses */}
      <SkeletonSection lines={3} />

      {/* Privileges */}
      <SkeletonSection lines={2} />

      {/* Sub-workflows */}
      <SkeletonSection lines={4} />
    </div>
  );
}

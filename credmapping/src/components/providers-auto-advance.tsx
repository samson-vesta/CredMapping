"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface ProvidersAutoAdvanceProps {
  enabled: boolean;
  nextHref: string;
  rootSelector: string;
  /** Label shown when all items have been loaded (enabled = false). */
  endMessage?: string;
}

export function ProvidersAutoAdvance({
  enabled,
  nextHref,
  rootSelector,
  endMessage = "You\u2019ve reached the end",
}: ProvidersAutoAdvanceProps) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasTriggeredRef = useRef(false);
  const [loading, setLoading] = useState(false);

  // Reset trigger + loading state whenever the href changes (new batch arrived)
  useEffect(() => {
    hasTriggeredRef.current = false;
    setLoading(false);
  }, [nextHref]);

  // Also clear loading when we transition from enabled → disabled (all loaded)
  useEffect(() => {
    if (!enabled) setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const rootElement = document.querySelector(rootSelector);
    const sentinel = sentinelRef.current;

    if (!(rootElement instanceof HTMLElement) || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasTriggeredRef.current) {
          return;
        }

        hasTriggeredRef.current = true;
        setLoading(true);
        router.push(nextHref);
      },
      {
        root: rootElement,
        rootMargin: "0px 0px 120px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [enabled, nextHref, rootSelector, router]);

  // ── All items loaded ────────────────────────────────────────
  if (!enabled) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <span className="h-px w-8 bg-border" />
        {endMessage}
        <span className="h-px w-8 bg-border" />
      </div>
    );
  }

  // ── Loading next batch ──────────────────────────────────────
  return (
    <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-6">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading more…</span>
        </div>
      )}
    </div>
  );
}

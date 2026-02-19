"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface ProvidersAutoAdvanceProps {
  enabled: boolean;
  nextHref: string;
  rootSelector: string;
}

export function ProvidersAutoAdvance({
  enabled,
  nextHref,
  rootSelector,
}: ProvidersAutoAdvanceProps) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [nextHref]);

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

  return <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />;
}

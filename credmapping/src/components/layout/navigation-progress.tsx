"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A thin progress bar at the top of the viewport that animates
 * during Next.js App Router navigations.
 *
 * It works by intercepting in-app anchor clicks (to detect navigation
 * *start*) and watching `usePathname()` for changes (to detect
 * navigation *end*).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevPathname = useRef(pathname);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (doneTimeoutRef.current) {
      clearTimeout(doneTimeoutRef.current);
      doneTimeoutRef.current = null;
    }
  }, []);

  // ── Detect navigation START by intercepting link clicks ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("#") ||
        anchor.target === "_blank"
      )
        return;

      // Don't trigger for the page we're already on
      if (href === pathname) return;

      clearTimers();
      setIsNavigating(true);
      setProgress(13); // start at ~13% for instant visual cue
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, clearTimers]);

  // ── Detect navigation END when pathname changes ──
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      clearTimers();
      setProgress(100);

      doneTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);
    }
  }, [pathname, clearTimers]);

  // ── Gradually tick progress while navigating ──
  useEffect(() => {
    if (isNavigating && progress < 90) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          // Slow logarithmic growth — feels natural
          return prev + (90 - prev) * 0.08;
        });
      }, 200);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isNavigating, progress]);

  if (!isNavigating) return null;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)] transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

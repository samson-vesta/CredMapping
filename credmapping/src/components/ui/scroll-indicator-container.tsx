"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface ScrollIndicatorContainerProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}

export function ScrollIndicatorContainer({
  children,
  className,
  viewportClassName,
}: ScrollIndicatorContainerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showTopIndicator, setShowTopIndicator] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateIndicators = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const maxScrollTop = scrollHeight - clientHeight;
      setShowTopIndicator(scrollTop > 2);
      setShowBottomIndicator(maxScrollTop - scrollTop > 2);
    };

    updateIndicators();
    viewport.addEventListener("scroll", updateIndicators, { passive: true });

    const resizeObserver = new ResizeObserver(updateIndicators);
    resizeObserver.observe(viewport);

    const contentRoot = viewport.firstElementChild;
    if (contentRoot instanceof HTMLElement) {
      resizeObserver.observe(contentRoot);
    }

    const mutationObserver = new MutationObserver(updateIndicators);
    mutationObserver.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      viewport.removeEventListener("scroll", updateIndicators);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return (
    <div className={cn("relative min-h-0", className)}>
      <div
        ref={viewportRef}
        className={cn(
          "hide-scrollbar min-h-0 h-full overflow-y-auto",
          viewportClassName,
        )}
      >
        {children}
      </div>

      {showTopIndicator && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-background via-background/65 to-transparent" />
      )}
      {showBottomIndicator && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-background via-background/65 to-transparent" />
      )}
    </div>
  );
}

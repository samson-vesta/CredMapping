"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

// ─── Context ────────────────────────────────────────────────────

const PendingContext = createContext(false);
const SetPendingContext = createContext<(v: boolean) => void>(() => void 0);

export function ProvidersPendingProvider({ children }: { children: ReactNode }) {
  const [isPending, setIsPending] = useState(false);
  return (
    <SetPendingContext.Provider value={setIsPending}>
      <PendingContext.Provider value={isPending}>
        {children}
      </PendingContext.Provider>
    </SetPendingContext.Provider>
  );
}

export function useProvidersPending() {
  return useContext(PendingContext);
}

export function useSetProvidersPending(isPending: boolean) {
  const set = useContext(SetPendingContext);
  const prev = useRef(isPending);
  useEffect(() => {
    if (prev.current === isPending) return;
    prev.current = isPending;
    set(isPending);
  }, [isPending, set]);
}

// ─── List overlay ────────────────────────────────────────────────

export function ProvidersListOverlay({ children }: { children: ReactNode }) {
  const isPending = useProvidersPending();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {isPending && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 backdrop-blur-[2px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading providers…</p>
        </div>
      )}
      <div
        className={`flex min-h-0 flex-1 flex-col ${isPending ? "pointer-events-none select-none opacity-40 transition-opacity" : "transition-opacity"}`}
      >
        {children}
      </div>
    </div>
  );
}

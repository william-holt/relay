"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import type { Business } from "@/types";

interface BusinessContextValue {
  businesses: Business[];
  current: Business | null;
  currentId: string | null;
  loading: boolean;
  setCurrentId: (id: string) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BusinessContextValue | null>(null);

const STORAGE_KEY = "relay.currentBusinessId";

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/businesses");
      if (!res.ok) return;
      const { businesses } = await res.json();
      setBusinesses(businesses ?? []);

      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;

      setCurrentIdState((prev) => {
        const candidate = prev ?? stored;
        const valid = (businesses ?? []).some((b: Business) => b.id === candidate);
        return valid ? candidate! : businesses?.[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") refresh();
    if (status === "unauthenticated") {
      setBusinesses([]);
      setCurrentIdState(null);
      setLoading(false);
    }
  }, [status, refresh]);

  const setCurrentId = useCallback((id: string) => {
    setCurrentIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const current = businesses.find((b) => b.id === currentId) ?? null;

  return (
    <Ctx.Provider
      value={{ businesses, current, currentId, loading, setCurrentId, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}

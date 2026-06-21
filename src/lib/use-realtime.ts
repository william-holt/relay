"use client";

import { useEffect, useRef } from "react";
import { Client } from "appwrite";

/**
 * Subscribe to live changes on Appwrite collections and run `onChange` (debounced)
 * whenever a document the user can read is created/updated/deleted.
 *
 * Uses a short-lived JWT minted by /api/auth/realtime-token. Appwrite only
 * delivers events for documents the user has permission to read, so team-scoped
 * document permissions keep this naturally tenant-safe. Best-effort: if realtime
 * can't connect, the app still works via manual refresh.
 */
export function useRealtime(collections: string[], onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = collections.join(",");

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    // Re-mint the JWT periodically (Appwrite JWTs expire after ~15 min).
    let refresh: ReturnType<typeof setInterval> | undefined;

    async function connect() {
      try {
        const res = await fetch("/api/auth/realtime-token");
        if (!res.ok || cancelled) return;
        const { jwt, endpoint, project, databaseId } = await res.json();
        if (cancelled || !endpoint || !project) return;

        const client = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt);
        const channels = collections.map(
          (c) => `databases.${databaseId}.collections.${c}.documents`
        );
        unsubscribe = client.subscribe(channels, () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => cb.current(), 400);
        });
      } catch {
        // Ignore — realtime is an enhancement, not a requirement.
      }
    }

    connect();
    refresh = setInterval(() => {
      if (unsubscribe) unsubscribe();
      connect();
    }, 14 * 60_000);

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (debounce) clearTimeout(debounce);
      if (refresh) clearInterval(refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

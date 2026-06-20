import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 * This bypasses RLS — only import it from server code (API routes, server
 * actions, server components). Never expose the service role key to the client.
 *
 * The client is created lazily on first use so a missing-env misconfiguration
 * fails loudly at request time (with a clear error) instead of silently
 * constructing a broken client — while still allowing `next build` to evaluate
 * route modules without secrets present.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(c) : value;
  },
});

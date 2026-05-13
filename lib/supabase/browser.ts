import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env/public";

/**
 * Browser / client-component Supabase client. Uses `@supabase/ssr` singleton
 * behavior in the browser so auth listeners share one client.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}

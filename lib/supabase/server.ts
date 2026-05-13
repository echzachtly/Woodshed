import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnv } from "@/lib/env/public";

/**
 * Server Components, Server Actions, and Route Handlers. Cookie writes may
 * throw in a plain Server Component; call from Route Handlers / Actions when
 * you need to mutate the session.
 */
export async function createServerSupabaseClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component: cookies are read-only here.
        }
        void headers;
      },
    },
  });
}

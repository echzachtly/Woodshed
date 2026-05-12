/**
 * Public (browser-safe) environment values.
 * Never import `SUPABASE_SERVICE_ROLE_KEY` into client components or `NEXT_PUBLIC_*` files.
 */

export function getSupabasePublicEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabasePublicEnv();
  return Boolean(url && anonKey);
}

import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env/public";

/**
 * Lightweight deploy smoke check. Does not expose secrets.
 * `supabase: true` only means public URL + anon key are both non-empty.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    supabase: isSupabaseConfigured(),
  });
}

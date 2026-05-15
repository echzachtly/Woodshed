/**
 * Phase 3 — neutral timeline prototype (DAW-style ruler / practice strip).
 *
 * Does **not** ship enabled by default. Set at build time:
 *
 * ```
 * NEXT_PUBLIC_WOODSHED_NEUTRAL_TIMELINE_PROTOTYPE=true
 * ```
 *
 * Reload/rebuild required after changing env in Next.js.
 */
export const NEUTRAL_TIMELINE_PROTOTYPE_ENABLED =
  process.env.NEXT_PUBLIC_WOODSHED_NEUTRAL_TIMELINE_PROTOTYPE === "true";

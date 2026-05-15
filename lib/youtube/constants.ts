/**
 * Dev-only gate for YouTube playback architecture prototype (Phase 4).
 *
 * ```
 * NEXT_PUBLIC_WOODSHED_YOUTUBE_PROTOTYPE=true
 * ```
 *
 * Visit `/dev/youtube-prototype` after enabling.
 */

export const YOUTUBE_PROTOTYPE_ENABLED =
  process.env.NEXT_PUBLIC_WOODSHED_YOUTUBE_PROTOTYPE === "true";

/** Default demo clip for the sandbox player — widely embeddable short sample. */
export const YOUTUBE_PROTOTYPE_DEFAULT_VIDEO_ID = "jNQXAC9IVRw";

/**
 * Phase 5 — isolated practice workspace (`components/youtube-workspace.tsx`): synthetic timeline +
 * shared store + loop rail (no persistence, dev route only).
 *
 * ```
 * NEXT_PUBLIC_WOODSHED_YOUTUBE_WORKSPACE=true
 * ```
 *
 * Visit `/dev/youtube-workspace`.
 */
export const YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED =
  process.env.NEXT_PUBLIC_WOODSHED_YOUTUBE_WORKSPACE === "true";

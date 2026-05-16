/**
 * Main-app YouTube import helpers (feature-flagged prod integration).
 */

import { extractYoutubeVideoId } from "@/lib/youtube/parse-video-id";
import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";
import {
  normalizeMediaSourceFromStoredProject,
  type StoredMediaSourceFields,
} from "@/lib/woodshed-media-source";

export function canonicalYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Parse a pasted URL or bare id into a normalized YouTube {@link WoodshedMediaSource}.
 */
export function parseYoutubePasteForMediaSource(raw: string): Extract<
  WoodshedMediaSource,
  { kind: "youtube" }
> | null {
  const videoId = extractYoutubeVideoId(raw);
  if (!videoId) return null;
  const trimmed = raw.trim();
  let canonicalUrl = canonicalYoutubeWatchUrl(videoId);
  if (trimmed) {
    try {
      const href = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
      const url = new URL(href);
      const host = url.hostname.replace(/^www\./i, "").toLowerCase();
      if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "youtu.be"
      ) {
        canonicalUrl = url.toString();
      }
    } catch {
      /* fall back */
    }
  }
  return {
    kind: "youtube",
    videoId,
    canonicalUrl,
    title: null,
    durationSeconds: null,
  };
}

export function storedProjectUsesYoutubeMedia(
  meta: StoredMediaSourceFields,
): boolean {
  return normalizeMediaSourceFromStoredProject(meta).kind === "youtube";
}

/** Upload / WaveSurfer path — local Dexie rows need an audio blob (or explicit blob passed in). */
export function storedProjectNeedsArchivedAudioBlob(
  meta: StoredMediaSourceFields,
): boolean {
  return normalizeMediaSourceFromStoredProject(meta).kind === "upload";
}

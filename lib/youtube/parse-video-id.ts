/**
 * Extract an 11-character YouTube video id from common URL shapes or a bare id.
 * Returns null when invalid — callers must avoid constructing YT.Player with null.
 */

const ID_RE = /^[\w-]{11}$/;

function coerceId(segment: string | null | undefined): string | null {
  if (!segment) return null;
  const id = segment.trim();
  return ID_RE.test(id) ? id : null;
}

export function extractYoutubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const bare = coerceId(trimmed);
  if (bare) return bare;

  try {
    const href = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const seg = url.pathname.split("/").filter(Boolean)[0];
      return coerceId(seg ?? null);
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = url.searchParams.get("v");
      if (v) return coerceId(v);

      const parts = url.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return coerceId(parts[embedIdx + 1]);
      }
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
        return coerceId(parts[shortsIdx + 1]);
      }
      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) {
        return coerceId(parts[liveIdx + 1]);
      }
    }
  } catch {
    return null;
  }

  return null;
}

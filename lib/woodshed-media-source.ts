/**
 * Discriminates where session audio comes from (Phase 2 — model only).
 * Today only `upload` is exercised; `youtube` reserves the shape for a future IFrame API path.
 */

export type WoodshedMediaSource =
  | {
      kind: "upload";
      blobId?: string | null;
      fileName?: string | null;
      mimeType?: string | null;
    }
  | {
      kind: "youtube";
      videoId: string;
      canonicalUrl: string;
      title?: string | null;
      durationSeconds?: number | null;
    };

/** Fresh workspace / reset — uploaded-audio workflow default. */
export const DEFAULT_UPLOAD_MEDIA_SOURCE: WoodshedMediaSource = {
  kind: "upload",
  blobId: null,
  fileName: null,
  mimeType: null,
};

export type StoredMediaSourceFields = {
  blobId?: string | null;
  mediaSource?: WoodshedMediaSource | null;
};

/**
 * Dexie rows (and similar payloads) created before Phase 2 omit `mediaSource`.
 * Legacy uploads always coerce to `{ kind: "upload", blobId }`.
 */
export function normalizeMediaSourceFromStoredProject(
  meta: StoredMediaSourceFields,
): WoodshedMediaSource {
  const raw = meta.mediaSource;
  if (raw && typeof raw === "object") {
    if (raw.kind === "youtube") {
      const videoId =
        typeof raw.videoId === "string" && raw.videoId.trim().length > 0
          ? raw.videoId.trim()
          : "";
      const canonicalUrl =
        typeof raw.canonicalUrl === "string" ? raw.canonicalUrl : "";
      if (videoId && canonicalUrl) {
        const durationSeconds =
          typeof raw.durationSeconds === "number" &&
          Number.isFinite(raw.durationSeconds)
            ? raw.durationSeconds
            : null;
        return {
          kind: "youtube",
          videoId,
          canonicalUrl,
          title:
            typeof raw.title === "string" || raw.title === null
              ? raw.title
              : null,
          durationSeconds,
        };
      }
    }
    if (raw.kind === "upload") {
      return {
        kind: "upload",
        blobId:
          raw.blobId !== undefined && raw.blobId !== null
            ? raw.blobId
            : meta.blobId ?? null,
        fileName:
          typeof raw.fileName === "string" || raw.fileName === null
            ? raw.fileName
            : null,
        mimeType:
          typeof raw.mimeType === "string" || raw.mimeType === null
            ? raw.mimeType
            : null,
      };
    }
  }
  return {
    kind: "upload",
    blobId: meta.blobId ?? null,
    fileName: null,
    mimeType: null,
  };
}

/** Row shape written to Dexie — keeps `blobId` aligned with FK on upload saves. */
export function persistMediaSourceForDexieRow(args: {
  source: WoodshedMediaSource;
  resolvedBlobId: string | null;
}): WoodshedMediaSource {
  const { source, resolvedBlobId } = args;
  if (source.kind !== "upload") return source;
  return {
    kind: "upload",
    blobId: resolvedBlobId ?? source.blobId ?? null,
    fileName: source.fileName ?? null,
    mimeType: source.mimeType ?? null,
  };
}

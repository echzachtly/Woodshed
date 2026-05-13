/** Supabase Storage bucket id (must match migration). */
export const WOODSHED_AUDIO_BUCKET = "woodshed-audio" as const;

/** Session picker value prefix for cloud-backed projects. */
export const CLOUD_SESSION_PREFIX = "cloud:" as const;

export function cloudSessionPickerValue(projectId: string): string {
  return `${CLOUD_SESSION_PREFIX}${projectId}`;
}

export function parseCloudSessionPickerValue(value: string): string | null {
  if (!value.startsWith(CLOUD_SESSION_PREFIX)) return null;
  const id = value.slice(CLOUD_SESSION_PREFIX.length);
  return id || null;
}

/**
 * Cloud project ids are UUID v4 strings. Local Dexie ids are short nanoids
 * without dashes, so this check is stable for routing saves and the picker.
 */
export function isCloudProjectId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export function audioStoragePath(userId: string, projectId: string): string {
  return `${userId}/${projectId}/audio`;
}

export function nanoid(length = 12): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, length);
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, length)}`;
}

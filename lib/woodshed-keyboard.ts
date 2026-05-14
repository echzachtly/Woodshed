/**
 * Returns true when the event target is inside a control where global
 * workspace shortcuts should not fire (typing, renaming, etc.).
 */
export function isKeyboardFocusInTextField(
  target: EventTarget | null,
): boolean {
  if (target == null) return false;
  /** Vitest / Node have no DOM `Element`; browser workspace always does. */
  if (typeof Element === "undefined") return false;
  if (!(target instanceof Element)) return false;
  const field = target.closest(
    'input, textarea, select, [contenteditable="true"]',
  );
  if (!field) return false;
  if (field instanceof HTMLInputElement) {
    const t = (field.getAttribute("type") ?? "text").toLowerCase();
    if (
      t === "button" ||
      t === "submit" ||
      t === "reset" ||
      t === "checkbox" ||
      t === "radio" ||
      t === "file" ||
      t === "range" ||
      t === "hidden" ||
      t === "image"
    ) {
      return false;
    }
    return true;
  }
  return true;
}

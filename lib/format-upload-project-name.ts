/**
 * Turn an uploaded filename into a readable project title:
 * strip extension, replace underscores/dashes with spaces, collapse whitespace.
 */
export function formatFilenameAsProjectName(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, "");
  const spaced = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced.length > 0 ? spaced : "Untitled session";
}

import { describe, expect, it } from "vitest";

import { formatFilenameAsProjectName } from "@/lib/format-upload-project-name";

describe("formatFilenameAsProjectName", () => {
  it("strips extension and replaces separators with spaces", () => {
    expect(
      formatFilenameAsProjectName("Automatic_Live_At_King_King_1992.mp3"),
    ).toBe("Automatic Live At King King 1992");
  });

  it("handles dashes and collapses whitespace", () => {
    expect(formatFilenameAsProjectName("My-Song__demo.wav")).toBe("My Song demo");
  });

  it("falls back when basename is empty", () => {
    expect(formatFilenameAsProjectName(".mp3")).toBe("Untitled session");
  });
});

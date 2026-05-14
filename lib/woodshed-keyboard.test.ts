import { describe, expect, it } from "vitest";

import { isKeyboardFocusInTextField } from "@/lib/woodshed-keyboard";

describe("isKeyboardFocusInTextField", () => {
  it("returns false for null", () => {
    expect(isKeyboardFocusInTextField(null)).toBe(false);
  });
});

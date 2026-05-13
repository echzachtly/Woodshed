import { describe, expect, it } from "vitest";

import { isCloudProjectId } from "@/lib/cloud-projects/constants";

describe("isCloudProjectId", () => {
  it("accepts UUID v4 with dashes", () => {
    expect(isCloudProjectId("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(true);
  });

  it("rejects nanoid-style local ids", () => {
    expect(isCloudProjectId("a1b2c3d4e5f6")).toBe(false);
  });

  it("rejects demo id", () => {
    expect(isCloudProjectId("demo-project")).toBe(false);
  });
});

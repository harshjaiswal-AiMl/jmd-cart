import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Gate D: Feature Parity Checklist Guard", () => {
  it("verifies that parity.json covers all 37 core website and app features", () => {
    const parityPath = path.resolve(process.cwd(), "parity.json");
    expect(fs.existsSync(parityPath)).toBe(true);

    const parityData = JSON.parse(fs.readFileSync(parityPath, "utf-8"));
    expect(parityData.appId).toBe("com.jmdcart.shop");
    expect(Array.isArray(parityData.mappings)).toBe(true);
    expect(parityData.mappings.length).toBeGreaterThanOrEqual(37);

    for (const mapping of parityData.mappings) {
      expect(mapping.featureId).toBeDefined();
      expect(mapping.websiteUrl).toBeDefined();
      expect(mapping.appScreen).toBeDefined();
      expect(mapping.component).toBeDefined();
      expect(mapping.status).toBe("IMPLEMENTED");
    }
  });
});

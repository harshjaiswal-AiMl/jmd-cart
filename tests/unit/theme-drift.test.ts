import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { colors, typography, spacing, borderRadius } from "../../apps/customer-mobile/src/theme/tokens";

describe("Gate B: Design Token Drift Guard", () => {
  it("ensures React Native theme matches design.tokens.json exactly", () => {
    const tokensPath = path.resolve(process.cwd(), "design.tokens.json");
    expect(fs.existsSync(tokensPath)).toBe(true);

    const jsonTokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));

    expect(colors.primary.container).toBe(jsonTokens.colors.primary.container);
    expect(colors.secondary.container).toBe(jsonTokens.colors.secondary.container);
    expect(colors.maroon).toBe(jsonTokens.colors.maroon);
    expect(colors.orange).toBe(jsonTokens.colors.orange);
    expect(colors.cream).toBe(jsonTokens.colors.cream);

    expect(typography.fontFamilyHeadline).toBe(jsonTokens.typography.fontFamilyHeadline);
    expect(typography.fontFamilyBody).toBe(jsonTokens.typography.fontFamilyBody);

    expect(spacing.md).toBe(jsonTokens.spacing.md);
    expect(borderRadius.lg).toBe(jsonTokens.borderRadius.lg);
  });
});

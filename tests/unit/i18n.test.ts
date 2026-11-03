import { describe, it, expect } from "vitest";
import en from "../../apps/customer-mobile/src/i18n/en.json";
import hi from "../../apps/customer-mobile/src/i18n/hi.json";

function extractKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys = keys.concat(extractKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("Gate D / Extra Features: Bilingual i18n Completeness", () => {
  it("ensures English and Hindi translations have 100% identical key coverage", () => {
    const enKeys = extractKeys(en).sort();
    const hiKeys = extractKeys(hi).sort();

    expect(enKeys.length).toBeGreaterThan(30);
    expect(hiKeys).toEqual(enKeys);
  });
});

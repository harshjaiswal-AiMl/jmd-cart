import { describe, it, expect } from "vitest";
import { VAN_TRANSLATIONS, VanLanguage, VanTranslationStrings } from "@/lib/i18n/van-translations";

describe("Van Sales Language & i18n", () => {
  it("should have complete translation parity between English and Hindi", () => {
    const enKeys = Object.keys(VAN_TRANSLATIONS.en).sort();
    const hiKeys = Object.keys(VAN_TRANSLATIONS.hi).sort();

    expect(enKeys).toEqual(hiKeys);
    expect(enKeys.length).toBeGreaterThan(20);

    // Verify no empty string or undefined in any language
    for (const key of enKeys as Array<keyof VanTranslationStrings>) {
      expect(VAN_TRANSLATIONS.en[key]).toBeTruthy();
      expect(typeof VAN_TRANSLATIONS.en[key]).toBe("string");
      expect(VAN_TRANSLATIONS.hi[key]).toBeTruthy();
      expect(typeof VAN_TRANSLATIONS.hi[key]).toBe("string");
    }
  });

  it("should verify Hindi text contains valid Devanagari script for core buttons", () => {
    expect(VAN_TRANSLATIONS.hi.newSaleTitle).toContain("नया बिल");
    expect(VAN_TRANSLATIONS.hi.myStockTitle).toContain("गाड़ी का स्टॉक");
    expect(VAN_TRANSLATIONS.hi.endOfDayTitle).toContain("दिन का हिसाब");
    expect(VAN_TRANSLATIONS.hi.todaySales).toBe("आज की कुल बिक्री");
    expect(VAN_TRANSLATIONS.hi.cashInHand).toBe("हाथ में नकद (कैश)");
  });

  it("should verify navigation bar tab labels in Hindi and English", () => {
    expect(VAN_TRANSLATIONS.en.navStock).toBe("Stock");
    expect(VAN_TRANSLATIONS.hi.navStock).toBe("स्टॉक");

    expect(VAN_TRANSLATIONS.en.navNewBill).toBe("New Bill");
    expect(VAN_TRANSLATIONS.hi.navNewBill).toBe("नया बिल");

    expect(VAN_TRANSLATIONS.en.navCollect).toBe("Collect");
    expect(VAN_TRANSLATIONS.hi.navCollect).toBe("कलेक्शन");

    expect(VAN_TRANSLATIONS.en.navBills).toBe("Bills");
    expect(VAN_TRANSLATIONS.hi.navBills).toBe("आज के बिल");

    expect(VAN_TRANSLATIONS.en.navDayEnd).toBe("Day End");
    expect(VAN_TRANSLATIONS.hi.navDayEnd).toBe("हिसाब");
  });

  it("should correctly interpolate parameters in strings", () => {
    const rawEn = VAN_TRANSLATIONS.en.myStockSubtitle;
    const substitutedEn = rawEn.replace("{pieces}", "150").replace("{products}", "12");
    expect(substitutedEn).toBe("150 pcs loaded (12 products)");

    const rawHi = VAN_TRANSLATIONS.hi.myStockSubtitle;
    const substitutedHi = rawHi.replace("{pieces}", "150").replace("{products}", "12");
    expect(substitutedHi).toBe("कुल 150 पीस लोड (12 आइटम)");
  });

  it("should translate mobile PWA grid cards properly", () => {
    expect(VAN_TRANSLATIONS.hi.vanCounterTitle).toBe("वैन काउंटर");
    expect(VAN_TRANSLATIONS.hi.todaysBillsTitle).toBe("आज के बिल");
    expect(VAN_TRANSLATIONS.hi.cashCollectionsTitle).toBe("कैश कलेक्शन");
    expect(VAN_TRANSLATIONS.hi.dayEndCloseTitle).toBe("शाम का क्लोजिंग");
  });
});

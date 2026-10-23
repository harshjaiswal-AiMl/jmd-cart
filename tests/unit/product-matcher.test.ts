import { describe, it, expect } from "vitest";
import {
  calculateSimilarity,
  extractWeightsAndPacks,
  normalizeText,
} from "@/modules/ocr/product-matcher";

describe("Prompt 10: Product Matcher Unit Tests", () => {
  describe("Text Normalization & Weight Extraction", () => {
    it("normalizes text by stripping punctuation and lowercasing", () => {
      expect(normalizeText("MDH Haldi Powder (100G X 120Pch)")).toBe(
        "mdh haldi powder 100g x 120pch"
      );
      expect(normalizeText("Papad B.C 200 Gm*20")).toBe(
        "papad b c 200 gm*20"
      );
    });

    it("extracts grammage and pack tokens correctly", () => {
      expect(extractWeightsAndPacks("COW GHEE 200GM")).toEqual(["200gm"]);
      expect(extractWeightsAndPacks("Moong Dal 400gm*16kg")).toEqual(["400gm", "16kg"]);
      expect(extractWeightsAndPacks("MDH Mustard Oil (1LTR X 12Btl)")).toEqual(["1ltr"]);
    });
  });

  describe("Similarity Scoring", () => {
    it("scores identical items with score 1.0", () => {
      expect(calculateSimilarity("Haldi Powder 100g", "Haldi Powder 100g")).toBe(1.0);
    });

    it("gives high match scores for FMCG variations with matching weights", () => {
      const score = calculateSimilarity(
        "MDH Haldi Powder (100G X 120Pch)",
        "MDH Haldi Powder 100g"
      );
      expect(score).toBeGreaterThanOrEqual(0.65);
    });

    it("penalizes unrelated products", () => {
      const score = calculateSimilarity("Cow Ghee 200gm", "Papad B.C 400gm");
      expect(score).toBeLessThan(0.3);
    });
  });
});

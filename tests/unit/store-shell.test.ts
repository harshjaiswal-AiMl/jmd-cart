import { describe, it, expect } from "vitest";
import { resolveStorefrontRedirect } from "@/lib/store-redirects";
import { isStorefrontPublicPath } from "@/lib/host-routing";

describe("Part B — Storefront Shell & Routing Contracts", () => {
  it("has correct public routes configured for storefront shell navigation", () => {
    expect(isStorefrontPublicPath("/categories")).toBe(true);
    expect(isStorefrontPublicPath("/category/spices")).toBe(true);
    expect(isStorefrontPublicPath("/brands")).toBe(true);
    expect(isStorefrontPublicPath("/brand/mdh")).toBe(true);
    expect(isStorefrontPublicPath("/product/mustard-oil")).toBe(true);
    expect(isStorefrontPublicPath("/search")).toBe(true);
    expect(isStorefrontPublicPath("/wholesale")).toBe(true);
    expect(isStorefrontPublicPath("/cart")).toBe(true);
    expect(isStorefrontPublicPath("/checkout")).toBe(true);
    expect(isStorefrontPublicPath("/about")).toBe(true);
    expect(isStorefrontPublicPath("/contact")).toBe(true);
    expect(isStorefrontPublicPath("/faqs")).toBe(true);
  });

  it("handles legacy /store redirects preserving parameters for shell links", () => {
    expect(resolveStorefrontRedirect("/store/wholesale")).toEqual({
      destination: "/wholesale",
      permanent: true,
    });
    expect(resolveStorefrontRedirect("/store/cart")).toEqual({
      destination: "/cart",
      permanent: true,
    });
  });
});

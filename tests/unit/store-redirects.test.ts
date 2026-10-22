import { describe, it, expect } from "vitest";
import { resolveStorefrontRedirect } from "@/lib/store-redirects";

describe("resolveStorefrontRedirect", () => {
  it("redirects /store to /", () => {
    const res = resolveStorefrontRedirect("/store");
    expect(res).toEqual({ destination: "/", permanent: true });
  });

  it("redirects /store?category=spices to /category/spices", () => {
    const res = resolveStorefrontRedirect("/store", new URLSearchParams("category=spices"));
    expect(res?.destination).toBe("/category/spices");
  });

  it("redirects /store?company=fortune to /brand/fortune", () => {
    const res = resolveStorefrontRedirect("/store", new URLSearchParams("company=fortune"));
    expect(res?.destination).toBe("/brand/fortune");
  });

  it("redirects /store?q=atta to /search?q=atta", () => {
    const res = resolveStorefrontRedirect("/store", new URLSearchParams("q=atta"));
    expect(res?.destination).toBe("/search?q=atta");
  });

  it("redirects /store/products/123 to /product/123", () => {
    const res = resolveStorefrontRedirect("/store/products/123");
    expect(res?.destination).toBe("/product/123");
  });

  it("redirects /store/cart to /cart", () => {
    const res = resolveStorefrontRedirect("/store/cart");
    expect(res?.destination).toBe("/cart");
  });

  it("redirects /store/checkout to /checkout", () => {
    const res = resolveStorefrontRedirect("/store/checkout");
    expect(res?.destination).toBe("/checkout");
  });

  it("redirects /store/wholesale to /wholesale", () => {
    const res = resolveStorefrontRedirect("/store/wholesale");
    expect(res?.destination).toBe("/wholesale");
  });

  it("redirects /store/orders to /orders", () => {
    const res = resolveStorefrontRedirect("/store/orders");
    expect(res?.destination).toBe("/orders");
  });

  it("redirects /store/orders/ord_456 to /orders/ord_456", () => {
    const res = resolveStorefrontRedirect("/store/orders/ord_456");
    expect(res?.destination).toBe("/orders/ord_456");
  });

  it("returns null for non-store URLs", () => {
    expect(resolveStorefrontRedirect("/admin")).toBeNull();
    expect(resolveStorefrontRedirect("/cart")).toBeNull();
  });
});

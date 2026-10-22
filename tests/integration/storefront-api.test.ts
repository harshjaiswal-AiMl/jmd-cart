import { describe, it, expect, vi } from "vitest";
import { GET as getCatalog } from "@/app/api/store/v1/catalog/route";
import { GET as getCategories } from "@/app/api/store/v1/categories/route";
import { GET as getBrands } from "@/app/api/store/v1/brands/route";
import { GET as getSearch } from "@/app/api/store/v1/search/route";
import { GET as getSettings } from "@/app/api/store/v1/settings/route";
import { GET as getServiceability } from "@/app/api/store/v1/serviceability/route";
import { GET as getFaqs } from "@/app/api/store/v1/faqs/route";
import { POST as postContact } from "@/app/api/store/v1/contact/route";
import { NextRequest } from "next/server";

describe("Storefront v1 Public API Contract Tests", () => {
  it("GET /api/store/v1/settings returns valid storefront settings contract", async () => {
    const req = new NextRequest("http://localhost:3000/api/store/v1/settings");
    const res = await getSettings(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toHaveProperty("storeName");
    expect(json.data).toHaveProperty("phone");
    expect(json.data).toHaveProperty("whatsappNumber");
    expect(json.data).toHaveProperty("serviceablePincodes");
    expect(Array.isArray(json.data.serviceablePincodes)).toBe(true);
  });

  it("GET /api/store/v1/serviceability checks pincode correctly", async () => {
    const validReq = new NextRequest("http://localhost:3000/api/store/v1/serviceability?pincode=852201");
    const validRes = await getServiceability(validReq);
    expect(validRes.status).toBe(200);
    const validJson = await validRes.json();
    expect(validJson.ok).toBe(true);
    expect(validJson.data.serviceable).toBe(true);

    const invalidReq = new NextRequest("http://localhost:3000/api/store/v1/serviceability?pincode=110001");
    const invalidRes = await getServiceability(invalidReq);
    expect(invalidRes.status).toBe(200);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.ok).toBe(true);
    expect(invalidJson.data.serviceable).toBe(false);
  });

  it("GET /api/store/v1/search requires query term and returns shape", async () => {
    const emptyReq = new NextRequest("http://localhost:3000/api/store/v1/search?q=");
    const emptyRes = await getSearch(emptyReq);
    expect(emptyRes.status).toBe(200);
    const emptyJson = await emptyRes.json();
    expect(emptyJson.ok).toBe(true);
    expect(emptyJson.data).toEqual({ products: [], categories: [], brands: [] });
  });

  it("POST /api/store/v1/contact validates payload correctly", async () => {
    const invalidReq = new NextRequest("http://localhost:3000/api/store/v1/contact", {
      method: "POST",
      body: JSON.stringify({ name: "", phone: "123" }),
    });
    const invalidRes = await postContact(invalidReq);
    expect(invalidRes.status).toBe(400);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.ok).toBe(false);
    expect(invalidJson.error.code).toBe("VALIDATION_ERROR");
  });
});

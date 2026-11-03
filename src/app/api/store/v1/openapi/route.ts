import { NextResponse } from "next/server";

export async function GET() {
  const openApiDoc = {
    openapi: "3.1.0",
    info: {
      title: "JMD Cart Customer Storefront API",
      version: "1.0.0",
      description: "Official REST API for the JMD Cart native customer mobile app (Android & iOS).",
    },
    servers: [
      { url: "https://jmdcart.com/api/store/v1", description: "Production Server" },
      { url: "http://localhost:3000/api/store/v1", description: "Local Development Server" },
    ],
    paths: {
      "/app-config": {
        get: {
          summary: "Get mobile app runtime configuration, maintenance status & support contacts",
          responses: { "200": { description: "Runtime app configuration" } },
        },
      },
      "/auth/otp/send": {
        post: {
          summary: "Send 6-digit verification code with SMS autofill formatting",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    phone: { type: "string" },
                    appHash: { type: "string" },
                  },
                  required: ["phone"],
                },
              },
            },
          },
          responses: { "200": { description: "OTP sent" }, "400": { description: "Invalid phone or rate limited" } },
        },
      },
      "/auth/otp/verify": {
        post: {
          summary: "Verify OTP and obtain JWT access token and rotating refresh token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    phone: { type: "string" },
                    otp: { type: "string" },
                    deviceId: { type: "string" },
                    platform: { type: "string" },
                    fcmToken: { type: "string" },
                    guestCartItems: { type: "array" },
                  },
                  required: ["phone", "otp"],
                },
              },
            },
          },
          responses: { "200": { description: "Logged in successfully" } },
        },
      },
      "/auth/refresh": {
        post: {
          summary: "Rotate refresh token and get a fresh JWT access token",
          responses: { "200": { description: "Tokens refreshed" }, "401": { description: "Invalid token" } },
        },
      },
      "/home": {
        get: {
          summary: "Get homepage feed (banners, categories, featured products, announcements)",
          responses: { "200": { description: "Homepage feed with ETag support" } },
        },
      },
      "/categories": {
        get: {
          summary: "List all active product categories",
          responses: { "200": { description: "Categories list" } },
        },
      },
      "/brands": {
        get: {
          summary: "List all active brands/companies",
          responses: { "200": { description: "Brands list" } },
        },
      },
      "/products": {
        get: {
          summary: "List products with filtering, search query, and pagination",
          responses: { "200": { description: "Products list" } },
        },
      },
      "/products/{id}": {
        get: {
          summary: "Get single product detail with pack/unit options and tier prices",
          responses: { "200": { description: "Product detail" }, "404": { description: "Not found" } },
        },
      },
      "/search": {
        get: {
          summary: "Instant search suggestions and ranked product results",
          responses: { "200": { description: "Search results" } },
        },
      },
      "/cart": {
        get: {
          summary: "Get active cart summary with delivery charge calculation",
          responses: { "200": { description: "Cart summary" } },
        },
      },
      "/cart/items": {
        post: {
          summary: "Add or update item in cart",
          responses: { "200": { description: "Cart updated" } },
        },
      },
      "/checkout/quote": {
        get: {
          summary: "Get checkout quote with delivery slots and payment modes",
          responses: { "200": { description: "Checkout quote" } },
        },
      },
      "/checkout": {
        post: {
          summary: "Place order with address, delivery slot, and idempotency key",
          responses: { "200": { description: "Order confirmed" } },
        },
      },
      "/orders": {
        get: {
          summary: "List customer past orders",
          responses: { "200": { description: "Orders list" } },
        },
      },
      "/orders/{id}": {
        get: {
          summary: "Get live order tracking status (Booked -> Packed -> Dispatched -> Delivered)",
          responses: { "200": { description: "Order tracking detail" } },
        },
      },
      "/orders/{id}/cancel": {
        post: {
          summary: "Cancel order before packing",
          responses: { "200": { description: "Order cancelled" } },
        },
      },
      "/orders/{id}/reorder": {
        post: {
          summary: "One-tap reorder all items from past order into active cart",
          responses: { "200": { description: "Items added to cart" } },
        },
      },
      "/saved-lists": {
        get: {
          summary: "Get user's saved shopping lists",
          responses: { "200": { description: "Saved lists" } },
        },
        post: {
          summary: "Create a new saved shopping list",
          responses: { "200": { description: "List created" } },
        },
      },
      "/saved-lists/{id}/add-to-cart": {
        post: {
          summary: "Add all items from saved list into cart",
          responses: { "200": { description: "Items added to cart" } },
        },
      },
      "/notify-me": {
        post: {
          summary: "Request back-in-stock alert for an out-of-stock product",
          responses: { "200": { description: "Notification requested" } },
        },
      },
      "/account/profile": {
        get: {
          summary: "Get customer profile, GSTIN, and buyer approval status",
          responses: { "200": { description: "Profile details" } },
        },
        put: {
          summary: "Update profile or apply for wholesale/retailer account",
          responses: { "200": { description: "Profile updated" } },
        },
      },
      "/account/credit-summary": {
        get: {
          summary: "Get credit limit, outstanding khata balance, and ledger statement",
          responses: { "200": { description: "Credit statement" } },
        },
      },
      "/account/delete-account": {
        post: {
          summary: "Google Play compliant account deletion",
          responses: { "200": { description: "Account deleted" } },
        },
      },
      "/devices/register": {
        post: {
          summary: "Register customer device and FCM push notification token",
          responses: { "200": { description: "Device registered" } },
        },
      },
    },
  };

  return NextResponse.json(openApiDoc, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

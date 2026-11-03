/**
 * Typed API Client for JMD Cart Customer Mobile App
 * Direct integration with /api/store/v1
 */

export interface AppConfig {
  appName: string;
  version: {
    latestVersion: string;
    minSupportedVersion: string;
    forceUpdate: boolean;
    updateUrl: string;
  };
  maintenance: {
    enabled: boolean;
    title: string;
    message: string;
  };
  support: {
    phone: string;
    whatsapp: string;
    email: string;
    callHelpline: string;
    whatsappChat: string;
  };
  store: {
    currency: string;
    currencySymbol: string;
    defaultLanguage: string;
    availableLanguages: Array<{ code: string; label: string; nativeLabel: string }>;
    deliveryArea: string;
    deliverySlots: Array<{ id: string; label: string; active: boolean }>;
  };
  featureFlags: {
    savedLists: boolean;
    notifyMe: boolean;
    buyAgain: boolean;
    hindiLanguage: boolean;
    deliverySlots: boolean;
    tierPriceHints: boolean;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  buyerType?: string | null;
  buyerApproved: boolean;
  partyId?: string | null;
}

export class MobileApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private deviceId: string = "dev_jmd_mobile";

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL) || "https://jmdcart.com";
  }

  setTokens(accessToken: string | null, refreshToken: string | null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  setDeviceId(deviceId: string) {
    this.deviceId = deviceId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 token expiration and automatic refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAuthTokens();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error || `Request failed with status ${response.status}`;
      this.logError({ endpoint, status: response.status, message: errorMsg });
      throw new Error(errorMsg);
    }

    return response.json();
  }

  async refreshAuthTokens(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/store/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
          deviceId: this.deviceId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.accessToken;
        this.refreshToken = data.refreshToken;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Runtime App Configuration & Maintenance
  async getAppConfig(): Promise<AppConfig> {
    return this.request<AppConfig>("/api/store/v1/app-config");
  }

  // Authentication
  async sendOtp(phone: string, appHash?: string) {
    return this.request<{ success: boolean; message: string }>("/api/store/v1/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ phone, appHash }),
    });
  }

  async verifyOtp(params: {
    phone: string;
    otp: string;
    deviceId: string;
    fcmToken?: string;
    platform?: string;
    guestCartItems?: any[];
  }) {
    const data = await this.request<{
      success: boolean;
      accessToken: string;
      refreshToken: string;
      user: UserProfile;
    }>("/api/store/v1/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(params),
    });

    this.setTokens(data.accessToken, data.refreshToken);
    return data;
  }

  async logout(deviceId: string) {
    await this.request("/api/store/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }).catch(() => null);

    this.setTokens(null, null);
  }

  // Catalogue & Search
  async getHomeFeed() {
    return this.request<any>("/api/store/v1/home");
  }

  async getCategories() {
    return this.request<{ categories: any[] }>("/api/store/v1/categories");
  }

  async getBrands() {
    return this.request<{ brands: any[] }>("/api/store/v1/brands");
  }

  async getProducts(params: {
    categoryId?: string;
    brandId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params.categoryId) query.set("categoryId", params.categoryId);
    if (params.brandId) query.set("brandId", params.brandId);
    if (params.q) query.set("q", params.q);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));

    return this.request<any>(`/api/store/v1/products?${query.toString()}`);
  }

  async getProductDetail(idOrSlug: string) {
    return this.request<any>(`/api/store/v1/products/${idOrSlug}`);
  }

  async search(query: string, limit: number = 15) {
    return this.request<any>(`/api/store/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // Cart & Pricing
  async getCart() {
    return this.request<any>("/api/store/v1/cart");
  }

  async updateCartItem(productId: string, quantity: number) {
    return this.request<any>("/api/store/v1/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    });
  }

  async removeCartItem(productIdOrItemId: string) {
    return this.request<any>(`/api/store/v1/cart/items/${productIdOrItemId}`, {
      method: "DELETE",
    });
  }

  // Checkout & Orders
  async getCheckoutQuote() {
    return this.request<any>("/api/store/v1/checkout/quote");
  }

  async placeOrder(params: {
    deliveryAddress: string;
    contactPhone?: string;
    deliveryZoneCode?: string;
    deliverySlot?: string;
    customerNotes?: string;
    idempotencyKey?: string;
  }) {
    return this.request<any>("/api/store/v1/checkout", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getOrders() {
    return this.request<{ orders: any[]; total: number }>("/api/store/v1/orders");
  }

  async getOrderTracking(orderId: string) {
    return this.request<any>(`/api/store/v1/orders/${orderId}`);
  }

  async cancelOrder(orderId: string) {
    return this.request<any>(`/api/store/v1/orders/${orderId}/cancel`, {
      method: "POST",
    });
  }

  async reorder(orderId: string) {
    return this.request<any>(`/api/store/v1/orders/${orderId}/reorder`, {
      method: "POST",
    });
  }

  // Saved Lists & Back in stock
  async getSavedLists() {
    return this.request<{ lists: any[] }>("/api/store/v1/saved-lists");
  }

  async createSavedList(name: string, items: Array<{ productId: string; quantity: number }>) {
    return this.request<any>("/api/store/v1/saved-lists", {
      method: "POST",
      body: JSON.stringify({ name, items }),
    });
  }

  async addListToCart(listId: string) {
    return this.request<any>(`/api/store/v1/saved-lists/${listId}/add-to-cart`, {
      method: "POST",
    });
  }

  async requestNotifyMe(productId: string, phone?: string, fcmToken?: string) {
    return this.request<any>("/api/store/v1/notify-me", {
      method: "POST",
      body: JSON.stringify({ productId, phone, deviceId: this.deviceId, fcmToken }),
    });
  }

  // Account
  async getProfile() {
    return this.request<any>("/api/store/v1/account/profile");
  }

  async updateProfile(data: {
    name?: string;
    email?: string;
    requestedBuyerType?: string;
    businessName?: string;
    gstin?: string;
  }) {
    return this.request<any>("/api/store/v1/account/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getCreditSummary() {
    return this.request<any>("/api/store/v1/account/credit-summary");
  }

  async deleteAccount() {
    return this.request<any>("/api/store/v1/account/delete-account", {
      method: "POST",
    });
  }

  // Device & Push Registration
  async registerDevice(fcmToken?: string, locale: string = "en") {
    return this.request<any>("/api/store/v1/devices/register", {
      method: "POST",
      body: JSON.stringify({
        deviceId: this.deviceId,
        platform: "android",
        fcmToken,
        locale,
      }),
    });
  }

  // In-house telemetry and error logging (zero 3rd party ad/analytics SDKs)
  private logError(log: { endpoint: string; status: number; message: string }) {
    console.warn(`[MobileApiError] ${log.endpoint} (${log.status}): ${log.message}`);
  }
}

export const mobileApi = new MobileApiClient();

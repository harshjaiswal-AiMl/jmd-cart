import { settingsRepository } from "@/modules/settings/settings.repository";
import { StoreBanner, storeBannerSchema } from "./banner.types";
import { z } from "zod";

export const DEFAULT_STORE_BANNERS: StoreBanner[] = [
  {
    id: "banner-groceries",
    badge: "Direct Godown Pricing",
    title: "Kitchen Essentials & Staples",
    subtitle: "Chakki Atta, Pure Mustard Oils, Basmati Rice & Pulses",
    ctaText: "Shop Groceries",
    ctaLink: "/store",
    imageUrl: "/brand/banner-groceries.jpg",
    bgGradient: "from-[#5c0c1e] to-[#22030a]",
    active: true,
    order: 1,
  },
  {
    id: "banner-snacks",
    badge: "Daily Kirana Restock",
    title: "Packaged FMCG, Namkeen & Spices",
    subtitle: "Bikaji Bhujia, Tea, Biscuits & Everest Masale",
    ctaText: "Shop Snacks & Spices",
    ctaLink: "/store",
    imageUrl: "/brand/banner-snacks.jpg",
    bgGradient: "from-[#914d00] to-[#381c00]",
    active: true,
    order: 2,
  },
];

export class BannerService {
  async getBanners(): Promise<StoreBanner[]> {
    const data = await settingsRepository.getSetting<StoreBanner[]>("store_banners");
    if (!data || !Array.isArray(data) || data.length === 0) {
      await settingsRepository.setSetting("store_banners", DEFAULT_STORE_BANNERS);
      return DEFAULT_STORE_BANNERS;
    }
    return data.sort((a, b) => a.order - b.order);
  }

  async getActiveBanners(): Promise<StoreBanner[]> {
    const all = await this.getBanners();
    const active = all.filter((b) => b.active);
    return active.length > 0 ? active : DEFAULT_STORE_BANNERS.slice(0, 1);
  }

  async saveBanners(banners: StoreBanner[]): Promise<StoreBanner[]> {
    const parsed = z.array(storeBannerSchema).parse(banners);
    await settingsRepository.setSetting("store_banners", parsed);
    return parsed.sort((a, b) => a.order - b.order);
  }
}

export const bannerService = new BannerService();

import { settingsRepository } from "@/modules/settings/settings.repository";
import { storeService, StoreProductItem } from "@/modules/store/store.service";
import {
  DiwaliStoreConfig,
  diwaliStoreConfigSchema,
  DiwaliShowcaseData,
  DiwaliShowcaseShelf,
  DiwaliShelfKey,
} from "./diwali.types";

export const DEFAULT_DIWALI_CONFIG: DiwaliStoreConfig = {
  enabled: true,
  bannerTitle: "🪔 Shubh Deepawali Maha Store",
  bannerSubtitle:
    "Celebrate the festival of lights with royal gift hampers, authentic sweets, and handpicked dry fruits at direct godown rates!",
  bannerTag: "FESTIVE MEGA DEALS • LIVE WAREHOUSE DISPATCH",
  shelves: {
    gifts: {
      enabled: true,
      title: "Diwali Gift Hampers",
      subtitle: "Curated festive gift boxes for family, friends & corporate gifting",
      badge: "🎁 Royal Gifting",
      productIds: [],
    },
    sweets: {
      enabled: true,
      title: "Festive Sweets & Mithai",
      subtitle: "Fresh packaged sweets, soan papdi, gulab jamun & festive treats",
      badge: "🪔 Shubh Mithai",
      productIds: [],
    },
    dryFruits: {
      enabled: true,
      title: "Premium Dry Fruits & Nuts",
      subtitle: "Kaju, Badam, Kismis, Pista & festive dry fruit assortments",
      badge: "🥜 100% Royal Quality",
      productIds: [],
    },
  },
};

const SHELF_META: Record<
  DiwaliShelfKey,
  {
    icon: string;
    accentColor: string;
    searchQuery: string;
    categoryKeyword: string;
  }
> = {
  gifts: {
    icon: "redeem",
    accentColor: "from-amber-600 via-rose-700 to-amber-900",
    searchQuery: "gift",
    categoryKeyword: "gift",
  },
  sweets: {
    icon: "bakery_dining",
    accentColor: "from-orange-600 via-amber-600 to-yellow-700",
    searchQuery: "sweet",
    categoryKeyword: "sweet",
  },
  dryFruits: {
    icon: "nutrition",
    accentColor: "from-emerald-700 via-amber-700 to-amber-900",
    searchQuery: "dry fruit",
    categoryKeyword: "dry fruit",
  },
};

export class DiwaliService {
  async getConfig(): Promise<DiwaliStoreConfig> {
    try {
      const data = await settingsRepository.getSetting<DiwaliStoreConfig>("diwali_store_config");
      if (!data) {
        await settingsRepository.setSetting("diwali_store_config", DEFAULT_DIWALI_CONFIG);
        return DEFAULT_DIWALI_CONFIG;
      }
      return diwaliStoreConfigSchema.parse(data);
    } catch {
      return DEFAULT_DIWALI_CONFIG;
    }
  }

  async saveConfig(config: DiwaliStoreConfig): Promise<DiwaliStoreConfig> {
    const validated = diwaliStoreConfigSchema.parse(config);
    await settingsRepository.setSetting("diwali_store_config", validated);
    return validated;
  }

  async getDiwaliShowcase(buyerContext?: {
    buyerType?: string | null;
    buyerApproved?: boolean;
  }): Promise<DiwaliShowcaseData> {
    const config = await this.getConfig();

    if (!config.enabled) {
      return {
        enabled: false,
        bannerTitle: config.bannerTitle,
        bannerSubtitle: config.bannerSubtitle,
        bannerTag: config.bannerTag,
        shelves: [],
      };
    }

    const shelfKeys: DiwaliShelfKey[] = ["gifts", "sweets", "dryFruits"];
    const shelves: DiwaliShowcaseShelf[] = [];

    for (const key of shelfKeys) {
      const shelfCfg = config.shelves[key];
      if (!shelfCfg || !shelfCfg.enabled) continue;

      const meta = SHELF_META[key];
      let products: StoreProductItem[] = [];

      // 1. If admin explicitly assigned product IDs, load them
      if (shelfCfg.productIds && shelfCfg.productIds.length > 0) {
        const assignedRes = await storeService.getCatalogue({
          productIds: shelfCfg.productIds,
          limit: shelfCfg.productIds.length,
          buyerType: buyerContext?.buyerType,
          buyerApproved: buyerContext?.buyerApproved,
        });

        // Maintain the exact ordering configured by admin
        const map = new Map(assignedRes.products.map((p) => [p.id, p]));
        for (const id of shelfCfg.productIds) {
          const item = map.get(id);
          if (item) products.push(item);
        }
      }

      // 2. If fewer than 5 products, intelligently auto-fill from matching category/keywords
      if (products.length < 5) {
        const existingIds = new Set(products.map((p) => p.id));
        const needed = 5 - products.length;

        // Query by keyword or category
        const catRes = await storeService.getCatalogue({
          q: meta.searchQuery,
          limit: 10,
          inStockOnly: false,
          buyerType: buyerContext?.buyerType,
          buyerApproved: buyerContext?.buyerApproved,
        });

        for (const p of catRes.products) {
          if (!existingIds.has(p.id) && products.length < 5) {
            existingIds.add(p.id);
            products.push(p);
          }
        }

        // If still fewer than 5, pick top general catalogue products to ensure shelf is full
        if (products.length < 5) {
          const fallbackRes = await storeService.getCatalogue({
            limit: 10,
            inStockOnly: true,
            buyerType: buyerContext?.buyerType,
            buyerApproved: buyerContext?.buyerApproved,
          });
          for (const p of fallbackRes.products) {
            if (!existingIds.has(p.id) && products.length < 5) {
              existingIds.add(p.id);
              products.push(p);
            }
          }
        }
      }

      // Cap at 5 products per row as requested
      products = products.slice(0, 5);

      if (products.length > 0) {
        shelves.push({
          key,
          enabled: true,
          title: shelfCfg.title || DEFAULT_DIWALI_CONFIG.shelves[key].title,
          subtitle: shelfCfg.subtitle || DEFAULT_DIWALI_CONFIG.shelves[key].subtitle,
          badge: shelfCfg.badge || DEFAULT_DIWALI_CONFIG.shelves[key].badge,
          icon: meta.icon,
          accentColor: meta.accentColor,
          products,
        });
      }
    }

    return {
      enabled: config.enabled && shelves.length > 0,
      bannerTitle: config.bannerTitle,
      bannerSubtitle: config.bannerSubtitle,
      bannerTag: config.bannerTag,
      shelves,
    };
  }
}

export const diwaliService = new DiwaliService();

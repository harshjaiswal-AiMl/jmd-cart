import { settingsRepository } from "@/modules/settings/settings.repository";
import { storeService, StoreProductItem, getCategoryFallbackPhoto } from "@/modules/store/store.service";
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
      productIds: [
        "c1a178ffc0014ny6mh5x19mg3",
        "c1a178ffe00b0od2aqaa8rdb0",
        "c1a178ffe00afv382b4ynml0j",
        "c1a178ffe00b177y3q8giu9su",
        "c1a178ffe00aeauf1jv5jj70s",
      ],
    },
    sweets: {
      enabled: true,
      title: "Festive Sweets & Mithai",
      subtitle: "Fresh packaged sweets, soan papdi, gulab jamun & festive treats",
      badge: "🪔 Shubh Mithai",
      productIds: [
        "c1a178ffd0058or3rr6jzcnfn",
        "c1a178ffd004dmscjyhf9vf75",
        "c1a178ffd004fv276amz53e1n",
        "c1a178ffd0054165b16olaqu9",
        "c1a178ffd00514ue82gyc7wte",
      ],
    },
    dryFruits: {
      enabled: true,
      title: "Premium Dry Fruits & Nuts",
      subtitle: "Kaju, Badam, Kismis, Pista & festive dry fruit assortments",
      badge: "🥜 100% Royal Quality",
      productIds: [
        "c1a178e56003891hdokv93ko2",
        "c1a178e56003dgnti1tqaj3a7",
        "c1a178e560039ddsvuina0dqm",
        "c1a178e56003ajbs1o1kth70n",
        "c1a178e56003ell7zo59sbiy1",
      ],
    },
  },
};

const SHELF_META: Record<
  DiwaliShelfKey,
  {
    icon: string;
    accentColor: string;
    categoryId: string;
    defaultProductIds: string[];
    fallbackCategoryName: string;
  }
> = {
  gifts: {
    icon: "redeem",
    accentColor: "from-amber-600 via-rose-700 to-amber-900",
    categoryId: "cmvf48gsx004b2ji9w04y6kls",
    defaultProductIds: [
      "c1a178ffc0014ny6mh5x19mg3",
      "c1a178ffe00b0od2aqaa8rdb0",
      "c1a178ffe00afv382b4ynml0j",
      "c1a178ffe00b177y3q8giu9su",
      "c1a178ffe00aeauf1jv5jj70s",
    ],
    fallbackCategoryName: "Gift Hampers",
  },
  sweets: {
    icon: "bakery_dining",
    accentColor: "from-orange-600 via-amber-600 to-yellow-700",
    categoryId: "cmvf437yi00482ji919cwywy0",
    defaultProductIds: [
      "c1a178ffd0058or3rr6jzcnfn",
      "c1a178ffd004dmscjyhf9vf75",
      "c1a178ffd004fv276amz53e1n",
      "c1a178ffd0054165b16olaqu9",
      "c1a178ffd00514ue82gyc7wte",
    ],
    fallbackCategoryName: "Sweets",
  },
  dryFruits: {
    icon: "nutrition",
    accentColor: "from-emerald-700 via-amber-700 to-amber-900",
    categoryId: "cmvf32xge003t2ji9zqwl77z9",
    defaultProductIds: [
      "c1a178e56003891hdokv93ko2",
      "c1a178e56003dgnti1tqaj3a7",
      "c1a178e560039ddsvuina0dqm",
      "c1a178e56003ajbs1o1kth70n",
      "c1a178e56003ell7zo59sbiy1",
    ],
    fallbackCategoryName: "Dry Fruits",
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

      // 1. If admin explicitly assigned product IDs (or default fallback IDs), load them
      const targetIds =
        shelfCfg.productIds && shelfCfg.productIds.length > 0
          ? shelfCfg.productIds
          : meta.defaultProductIds;

      if (targetIds && targetIds.length > 0) {
        const assignedRes = await storeService.getCatalogue({
          productIds: targetIds,
          limit: targetIds.length,
          buyerType: buyerContext?.buyerType,
          buyerApproved: buyerContext?.buyerApproved,
        });

        // Maintain the exact ordering configured
        const map = new Map(assignedRes.products.map((p) => [p.id, p]));
        for (const id of targetIds) {
          const item = map.get(id);
          if (item) products.push(item);
        }
      }

      // 2. If fewer than 5 products, intelligently auto-fill from exact category ID
      if (products.length < 5) {
        const existingIds = new Set(products.map((p) => p.id));

        const catRes = await storeService.getCatalogue({
          categoryId: meta.categoryId,
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
      }

      // 3. Guarantee genuine fallback image for each product
      products = products.slice(0, 5).map((p) => ({
        ...p,
        imageUrl:
          p.imageUrl ||
          getCategoryFallbackPhoto(
            `${p.categoryName || meta.fallbackCategoryName} ${p.name}`
          ),
      }));

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

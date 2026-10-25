import { prisma } from "@/lib/prisma";
import {
  PriceSlabRule,
  SlabScope,
  BuyerTier,
} from "./pricing.types";

export const DEFAULT_PRICE_SLABS: PriceSlabRule[] = [
  {
    id: "slab-global-retailer",
    scope: SlabScope.GLOBAL,
    targetId: null,
    targetName: "All Products (Global)",
    minQty: 10,
    discountBp: 800, // 8.00%
    tier: BuyerTier.RETAILER,
    active: true,
  },
  {
    id: "slab-global-wholesaler",
    scope: SlabScope.GLOBAL,
    targetId: null,
    targetName: "All Products (Global)",
    minQty: 50,
    discountBp: 1500, // 15.00%
    tier: BuyerTier.WHOLESALER,
    active: true,
  },
];

export class PricingRepository {
  /**
   * Retrieve all configured price slabs. Returns defaults if unset.
   */
  async getSlabs(): Promise<PriceSlabRule[]> {
    const setting = await prisma.setting.findUnique({
      where: { key: "price_slabs" },
    });

    if (!setting || !Array.isArray(setting.value)) {
      return DEFAULT_PRICE_SLABS;
    }

    return setting.value as unknown as PriceSlabRule[];
  }

  /**
   * Persist price slabs in settings.
   */
  async saveSlabs(slabs: PriceSlabRule[]): Promise<void> {
    await prisma.setting.upsert({
      where: { key: "price_slabs" },
      update: { value: slabs as unknown as object },
      create: { key: "price_slabs", value: slabs as unknown as object },
    });
  }
}

export const pricingRepository = new PricingRepository();

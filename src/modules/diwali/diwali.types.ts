import { z } from "zod";
import { StoreProductItem } from "@/modules/store/store.service";

export type DiwaliShelfKey = "gifts" | "sweets" | "dryFruits";

export const diwaliShelfConfigSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().min(1).default(""),
  subtitle: z.string().default(""),
  badge: z.string().default(""),
  productIds: z.array(z.string()).default([]),
});

export type DiwaliShelfConfig = z.infer<typeof diwaliShelfConfigSchema>;

export const diwaliStoreConfigSchema = z.object({
  enabled: z.boolean().default(true),
  bannerTitle: z.string().default("🪔 Shubh Deepawali Maha Store"),
  bannerSubtitle: z
    .string()
    .default("Celebrate with handpicked festive gift hampers, authentic sweets, and royal dry fruits at wholesale godown rates!"),
  bannerTag: z.string().default("DIWALI SPECIAL • LIVE WAREHOUSE DISPATCH"),
  shelves: z.object({
    gifts: diwaliShelfConfigSchema,
    sweets: diwaliShelfConfigSchema,
    dryFruits: diwaliShelfConfigSchema,
  }),
});

export type DiwaliStoreConfig = z.infer<typeof diwaliStoreConfigSchema>;

export interface DiwaliShowcaseShelf {
  key: DiwaliShelfKey;
  enabled: boolean;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  accentColor: string;
  products: StoreProductItem[];
}

export interface DiwaliShowcaseData {
  enabled: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerTag: string;
  shelves: DiwaliShowcaseShelf[];
}

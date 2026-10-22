import { z } from "zod";

export const storeBannerSchema = z.object({
  id: z.string(),
  badge: z.string().min(1, "Badge is required"),
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().min(1, "Subtitle is required"),
  ctaText: z.string().min(1, "CTA Text is required"),
  ctaLink: z.string().min(1, "CTA Link is required"),
  secondaryCtaText: z.string().optional(),
  secondaryCtaLink: z.string().optional(),
  stat1Value: z.string().optional(),
  stat1Label: z.string().optional(),
  stat2Value: z.string().optional(),
  stat2Label: z.string().optional(),
  stat3Value: z.string().optional(),
  stat3Label: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  bgGradient: z.string().default("from-[#5c0c1e] via-[#420815] to-[#24040b]"),
  active: z.boolean().default(true),
  order: z.number().int().default(1),
});

export type StoreBanner = z.infer<typeof storeBannerSchema>;

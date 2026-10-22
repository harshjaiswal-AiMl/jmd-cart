import { z } from "zod";
import { Prisma } from "@prisma/client";

export const hsnRegex = /^[0-9]{4,8}$/;
export const ALLOWED_GST_RATES_BP = [0, 500, 1200, 1800, 2800] as const;

export const createProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(150),
  shortCode: z
    .string()
    .min(2, "Short code must be at least 2 characters")
    .max(60)
    .regex(/^[A-Za-z0-9\-_.]+$/, "Short code may only contain letters, numbers, hyphens, underscores and dots")
    .transform((val) => val.toUpperCase()),
  weight: z.string().max(40).nullable().optional(),
  companyId: z.string().cuid().nullable().optional(),
  categoryId: z.string().cuid().nullable().optional(),
  hsn: z.string().regex(hsnRegex, "HSN must be 4 to 8 numeric digits").default("0000"),
  gstRateBp: z
    .number()
    .int()
    .refine((val) => ALLOWED_GST_RATES_BP.includes(val as any), {
      message: "GST rate must be standard Indian GST slab (0, 500, 1200, 1800, or 2800 bp)",
    })
    .default(0),
  mrpPaise: z.number().int().positive("MRP must be greater than zero").nullable().optional(),
  priceAPaise: z.number().int().nonnegative().nullable().optional(),
  priceBPaise: z.number().int().nonnegative().nullable().optional(),
  priceCPaise: z.number().int().nonnegative().nullable().optional(),
  packSize: z.number().int().min(1, "Pack size must be at least 1 piece").default(1),
  packLabel: z.string().min(1).default("Carton"),
  reorderLevel: z.number().int().min(0).default(0),
  imageUrl: z
    .string()
    .trim()
    .refine(
      (val) => !val || val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:"),
      { message: "Image must be a valid web URL, local upload path, or data URI" }
    )
    .nullable()
    .optional(),
  active: z.boolean().default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().cuid(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(100),
  active: z.boolean().default(true),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const createCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters").max(100),
  active: z.boolean().default(true),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const productSearchQuerySchema = z.object({
  q: z.string().optional(),
  companyId: z.string().optional(),
  categoryId: z.string().optional(),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ProductSearchQueryInput = z.input<typeof productSearchQuerySchema>;
export type ProductSearchQuery = z.output<typeof productSearchQuerySchema>;

export type ProductWithDetails = Prisma.ProductGetPayload<{
  include: {
    company: true;
    category: true;
    stockBalances: {
      include: {
        location: true;
      };
    };
  };
}>;

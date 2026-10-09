import { z } from "zod";

export const transferStockSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  fromLocationId: z.string().min(1, "Source location is required"),
  toLocationId: z.string().min(1, "Destination location is required"),
  qty: z.number().int().positive("Transfer quantity must be greater than zero pieces"),
  reason: z.string().optional(),
  idempotencyKey: z.string().optional(),
}).refine((data) => data.fromLocationId !== data.toLocationId, {
  message: "Source and destination locations cannot be the same",
  path: ["toLocationId"],
});

export type TransferStockInput = z.infer<typeof transferStockSchema>;

export const cartonBreakSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  fromLocationId: z.string().min(1, "Source location is required"),
  toLocationId: z.string().min(1, "Destination location is required"),
  cartons: z.number().int().positive("Number of cartons must be greater than zero"),
  reason: z.string().optional(),
  idempotencyKey: z.string().optional(),
}).refine((data) => data.fromLocationId !== data.toLocationId, {
  message: "Source and destination locations cannot be the same",
  path: ["toLocationId"],
});

export type CartonBreakInput = z.infer<typeof cartonBreakSchema>;

export const recordDamageSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  locationId: z.string().min(1, "Location is required"),
  qty: z.number().int().positive("Damage quantity must be greater than zero pieces"),
  reason: z.string().min(3, "Reason for damage must be specified (at least 3 characters)"),
  idempotencyKey: z.string().optional(),
});

export type RecordDamageInput = z.infer<typeof recordDamageSchema>;

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  locationId: z.string().min(1, "Location is required"),
  adjustmentQty: z.number().int().refine((q) => q !== 0, {
    message: "Adjustment quantity cannot be zero",
  }),
  reason: z.string().min(3, "Reason for adjustment must be specified"),
  idempotencyKey: z.string().optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const createAuditSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  lines: z.array(
    z.object({
      productId: z.string().min(1),
      countedQty: z.number().int().min(0, "Counted quantity cannot be negative"),
    })
  ).min(1, "Audit must include at least one counted product line"),
  notes: z.string().optional(),
});

export type CreateAuditInput = z.infer<typeof createAuditSchema>;

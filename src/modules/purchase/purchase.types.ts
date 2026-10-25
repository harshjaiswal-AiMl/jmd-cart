import { z } from "zod";
import { Prisma, PurchaseStatus } from "@prisma/client";

export const purchaseItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  qty: z.number().int().positive("Quantity must be greater than zero pieces"),
  billedQty: z.number().int().optional().nullable(),
  acceptedQty: z.number().int().optional().nullable(),
  varianceReason: z.string().optional().nullable(),
  ratePaise: z.number().int().positive("Purchase rate must be greater than zero"),
  gstRateBp: z.number().int().min(0, "GST rate cannot be negative").default(0),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;

export const createPurchaseSchema = z.object({
  supplierId: z.string().optional().nullable(),
  billNo: z.string().min(1, "Supplier bill / invoice number is required"),
  billDate: z.coerce.date().default(() => new Date()),
  locationId: z.string().min(1, "Receiving location is required"),
  items: z.array(purchaseItemInputSchema).min(1, "At least one item must be included in the purchase"),
  billScanId: z.string().optional().nullable(),
  billTotalPaise: z.number().int().optional().nullable(),
  idempotencyKey: z.string().optional(),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export type PurchaseWithDetails = Prisma.PurchaseGetPayload<{
  include: {
    supplier: true;
    location: true;
    creator: {
      select: { id: true; name: true; role: true };
    };
    items: {
      include: {
        product: true;
      };
    };
  };
}>;

export interface PurchaseListFilter {
  locationId?: string;
  supplierId?: string;
  status?: PurchaseStatus;
  limit?: number;
  offset?: number;
}

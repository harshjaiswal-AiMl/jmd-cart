import { z } from "zod";
import { VanDay, VanDayLine, Location, Product, User, VanDayStatus } from "@prisma/client";

export const vanIssueItemSchema = z
  .object({
    productId: z.string().min(1, "Product ID is required"),
    cartons: z.number().int().min(0).default(0),
    pieces: z.number().int().min(0).default(0),
  })
  .refine((data) => data.cartons > 0 || data.pieces > 0, {
    message: "At least 1 carton or piece must be specified per product",
  });

export type VanIssueItemInput = z.infer<typeof vanIssueItemSchema>;

export const createVanIssueSheetSchema = z.object({
  vanLocationId: z.string().min(1, "Van location ID is required"),
  notes: z.string().max(500).optional(),
  items: z.array(vanIssueItemSchema).min(1, "At least one product line is required"),
});

export type CreateVanIssueSheetInput = z.infer<typeof createVanIssueSheetSchema>;

export interface VanDayLineWithProduct extends VanDayLine {
  product: Product;
}

export interface VanDayWithDetails extends VanDay {
  vanLocation: Location;
  salesperson: User;
  lines: VanDayLineWithProduct[];
}

export interface VanStockItem {
  product: Product;
  qty: number;
  cartons: number;
  loosePieces: number;
  valuationPaise: number;
}

export interface VanStockSummary {
  vanLocation: Location;
  salesperson: User | null;
  activeVanDay: VanDayWithDetails | null;
  inventory: VanStockItem[];
  totalPieces: number;
  totalValuationPaise: number;
}

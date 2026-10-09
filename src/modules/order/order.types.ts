import { z } from "zod";
import { OrderStatus, PartyType } from "@prisma/client";

export { OrderStatus, PartyType };

export const createOrderInputSchema = z.object({
  deliveryZoneCode: z.string().min(1, "Delivery zone is required"),
  deliveryAddress: z.string().min(5, "Delivery address must be at least 5 characters"),
  contactPhone: z.string().min(10, "Contact phone must be at least 10 digits"),
  customerNotes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export interface OrderItemSummary {
  id: string;
  productId: string;
  productName: string;
  shortCode: string;
  packSize: number;
  qty: number;
  cartons: number;
  loosePieces: number;
  mrpPaise: number;
  unitPricePaise: number;
  discountBp: number;
  lineDiscountPaise: number;
  taxablePaise: number;
  gstRateBp: number;
  taxPaise: number;
  hsn: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  branchId: number;
  userId: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  deliveryZoneCode: string;
  deliveryZoneName: string;
  deliveryFeePaise: number;
  subtotalPaise: number;
  lineDiscountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  buyerTag: PartyType;
  deliveryAddress: string;
  contactPhone: string;
  customerNotes?: string | null;
  invoiceId?: string | null;
  items: OrderItemSummary[];
  createdAt: Date;
  updatedAt: Date;
}

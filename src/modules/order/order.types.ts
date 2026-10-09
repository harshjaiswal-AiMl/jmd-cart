import { z } from "zod";
import { OrderStatus, PartyType, PaymentMode } from "@prisma/client";

export { OrderStatus, PartyType, PaymentMode };

export const createOrderInputSchema = z.object({
  deliveryZoneCode: z.string().min(1, "Delivery zone is required"),
  deliveryAddress: z.string().min(5, "Delivery address must be at least 5 characters"),
  contactPhone: z.string().min(10, "Contact phone must be at least 10 digits"),
  customerNotes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const assignDeliveryInputSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  deliveryStaffId: z.string().min(1, "Delivery staff ID is required"),
});
export type AssignDeliveryInput = z.infer<typeof assignDeliveryInputSchema>;

export const recordDeliveryPaymentInputSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  paymentMode: z.nativeEnum(PaymentMode),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});
export type RecordDeliveryPaymentInput = z.infer<typeof recordDeliveryPaymentInputSchema>;

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
  invoiceNumber?: string | null;
  assignedDeliveryUserId?: string | null;
  assignedDeliveryUserName?: string | null;
  assignedDeliveryUserPhone?: string | null;
  deliveredAt?: Date | null;
  paymentMode?: PaymentMode | null;
  paymentReference?: string | null;
  paymentNotes?: string | null;
  items: OrderItemSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PickListItem {
  productId: string;
  productName: string;
  shortCode: string;
  packSize: number;
  qty: number;
  unit: string;
  cartonsCount: number;
  looseCount: number;
  orderNumber: string;
}

export interface SplitPickLists {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZoneName: string;
  status: OrderStatus;
  createdAt: Date;
  // Shop Pick List: Loose pieces (qty % packSize > 0, or packSize == 1)
  shopLoosePicks: PickListItem[];
  // Godown Pick List: Full unopened cartons/packs (Math.floor(qty / packSize) > 0)
  godownPackPicks: PickListItem[];
  totalCartons: number;
  totalLoosePieces: number;
}

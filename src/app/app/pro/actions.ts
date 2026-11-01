"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { partyRepository } from "@/modules/party/party.repository";
import { manualOrderService } from "@/modules/order/manual-order.service";
import { PartyType, PaymentMode, OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function searchPartiesAction(q: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const result = await partyRepository.searchParties({
    q,
    activeOnly: true,
    limit: 20,
    offset: 0,
  });

  return result.parties.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    address: p.address,
    type: p.type,
    priceTier: p.type === PartyType.WHOLESALER ? 'C' : p.type === PartyType.RETAILER ? 'B' : 'A',
    creditLimitPaise: p.creditLimitPaise,
    outstandingPaise: p.outstandingPaise,
  }));
}

export async function createProPartyAction(data: {
  name: string;
  phone: string;
  address?: string;
  gst?: string;
  type?: PartyType;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!data.name || data.name.trim().length < 2) {
    throw new Error("Party name must be at least 2 characters");
  }

  const cleanPhone = (data.phone || "").replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    throw new Error("Valid 10-digit phone number is required");
  }

  // Check existing party by phone
  const existing = await prisma.party.findFirst({
    where: { phone: cleanPhone },
  });
  if (existing) {
    throw new Error(`Party with phone ${cleanPhone} already exists: ${existing.name}`);
  }

  const party = await prisma.party.create({
    data: {
      name: data.name.trim(),
      phone: cleanPhone,
      address: data.address?.trim() || null,
      gstin: data.gst?.trim() || null,
      type: data.type || PartyType.RETAILER,
      needsReview: true, // Tagged for Accounts team verification
      active: true,
    },
  });

  revalidatePath("/app/pro");
  return {
    success: true,
    party: {
      id: party.id,
      name: party.name,
      phone: party.phone,
      address: party.address,
      type: party.type,
      priceTier: party.type === PartyType.WHOLESALER ? 'C' : party.type === PartyType.RETAILER ? 'B' : 'A',
      creditLimitPaise: party.creditLimitPaise,
      outstandingPaise: 0,
    },
  };
}

export async function punchProOrderAction(data: {
  partyId: string;
  lines: Array<{
    productId: string;
    cartons: number;
    loose: number;
    overrideUnitPricePaise?: number;
  }>;
  customerNotes?: string;
  deliveryAddress?: string;
  contactPhone?: string;
  paymentMode?: PaymentMode;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const role = session.user.role as any;
  if (role !== "PRO" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: Only PRO agents and Admins can punch orders");
  }

  if (!data.lines || data.lines.length === 0) {
    throw new Error("Order must have at least one product line");
  }

  const result = await manualOrderService.createManualOrder(
    {
      partyId: data.partyId,
      lines: data.lines,
      deliveryAddress: data.deliveryAddress || "Saharsa",
      contactPhone: data.contactPhone || "0000000000",
      paymentMode: data.paymentMode || PaymentMode.CREDIT,
      customerNotes: data.customerNotes,
    },
    {
      id: session.user.id,
      name: session.user.name || "PRO Agent",
      role: session.user.role as any,
      agentCode: (session.user as any).agentCode || undefined,
    } as any
  );

  revalidatePath("/app/pro");
  revalidatePath("/app/godown");
  return {
    success: true,
    orderId: result.order.id,
    orderNumber: result.order.orderNumber,
    totalPaise: result.order.totalPaise,
  };
}

export async function cancelProOrderAction(orderId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Allowed to cancel only if still in BOOKED_BY_PRO status and creator is the PRO agent
  if (order.status !== (OrderStatus as any).BOOKED_BY_PRO && order.status !== OrderStatus.PENDING) {
    throw new Error("Cannot cancel order: warehouse has already accepted or processed it");
  }

  if (order.bookedByProId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("You can only cancel your own orders");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED },
  });

  revalidatePath("/app/pro");
  return { success: true };
}

export async function getProTodaySummaryAction() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const orders = await prisma.order.findMany({
    where: {
      bookedByProId: session.user.id,
      createdAt: { gte: startOfDay },
    },
    select: {
      id: true,
      orderNumber: true,
      totalPaise: true,
      status: true,
      createdAt: true,
    },
  });

  const totalPaise = orders.reduce((sum, o) => sum + (o.status !== OrderStatus.CANCELLED ? o.totalPaise : 0), 0);
  const count = orders.length;
  const bookedPending = orders.filter((o) => o.status === (OrderStatus as any).BOOKED_BY_PRO).length;
  const confirmed = orders.filter((o) => o.status === OrderStatus.CONFIRMED).length;
  const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;

  return {
    count,
    totalPaise,
    bookedPending,
    confirmed,
    delivered,
  };
}

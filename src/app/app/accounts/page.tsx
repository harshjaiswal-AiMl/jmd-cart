import React from "react";
import Link from "next/link";
import { Calculator, AlertCircle, ArrowRight, CheckCircle2, FileText, Search, CreditCard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AccountsClient } from "./accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsAppPage() {
  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      paymentStatus: { in: ["PENDING", "PARTIAL"] },
      status: "FINAL",
    },
    include: {
      party: { select: { id: true, name: true, phone: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const formattedInvoices = pendingInvoices.map((inv) => {
    const totalPaid = inv.payments.reduce((s, p) => s + p.amountPaise, 0);
    const pendingPaise = Math.max(0, inv.totalPaise - totalPaid);
    return {
      id: inv.id,
      number: inv.number,
      channel: inv.channel,
      partyId: inv.partyId,
      customerName: inv.customerName || inv.party?.name || "Walk-in Retail",
      customerPhone: inv.customerPhone || inv.party?.phone || "",
      customerAddress: inv.customerAddress || "",
      totalPaise: inv.totalPaise,
      totalPaidPaise: totalPaid,
      pendingPaise,
      createdAt: inv.createdAt.toISOString(),
    };
  });

  return <AccountsClient pendingInvoices={formattedInvoices} />;
}

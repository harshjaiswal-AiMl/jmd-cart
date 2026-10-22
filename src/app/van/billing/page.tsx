import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { VanBillingClient } from "./van-billing-client";

export const dynamic = "force-dynamic";

export default async function VanBillingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SALESPERSON &&
    session.user.role !== UserRole.SUPER_ADMIN
  ) {
    redirect("/login");
  }

  let van = await prisma.location.findFirst({
    where: {
      type: LocationType.VAN,
      assignedUserId: session.user.id,
      active: true,
    },
  });

  if (!van && session.user.role === UserRole.SUPER_ADMIN) {
    van = await prisma.location.findFirst({
      where: { type: LocationType.VAN, active: true },
    });
  }

  const stockSummary = van
    ? await vanService.getVanStockSummary(session.user.role, van.id)
    : null;

  if (!van || !stockSummary?.activeVanDay) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/van"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Van Sales Billing</h1>
            <p className="text-xs text-slate-400">
              {van ? van.name : "Unassigned Van"} • Route Retail & Counter Sales
            </p>
          </div>
        </div>

        <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-6 text-center text-amber-200 space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="font-bold text-base text-white">Morning Load Required</h3>
          <p className="text-xs text-amber-300/90 max-w-md mx-auto">
            {!van
              ? "No delivery vehicle is currently assigned to your staff profile."
              : `Van ${van.name} has no active morning load sheet dispatched today. You cannot create bills until Godown dispatches stock.`}
          </p>
          <div className="pt-2">
            <Link
              href="/van"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Return to Van Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch product company details for display
  const productIds = stockSummary.inventory.map((item) => item.product.id);
  const productsWithCompany = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { company: true },
  });
  const companyMap = new Map(productsWithCompany.map((p) => [p.id, p.company?.name || "General"]));

  const billingProducts = stockSummary.inventory
    .map((item) => ({
      id: item.product.id,
      name: item.product.name,
      shortCode: item.product.shortCode,
      packSize: item.product.packSize,
      packLabel: item.product.packLabel,
      mrpPaise: item.product.mrpPaise ?? item.product.priceCPaise ?? 0,
      availablePieces: item.qty,
      cartons: item.cartons,
      loosePieces: item.loosePieces,
      companyName: companyMap.get(item.product.id) || "General",
    }))
    .sort((a, b) => {
      const aIn = a.availablePieces > 0 ? 1 : 0;
      const bIn = b.availablePieces > 0 ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      return a.name.localeCompare(b.name);
    });


  // Fetch active customer parties and their live balances
  const parties = await prisma.party.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      creditEnabled: true,
      creditLimitPaise: true,
      ledgerEntries: {
        select: {
          debitPaise: true,
          creditPaise: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const partyOptions = parties.map((p) => {
    const totalDebit = p.ledgerEntries.reduce((sum, e) => sum + e.debitPaise, 0);
    const totalCredit = p.ledgerEntries.reduce((sum, e) => sum + e.creditPaise, 0);
    return {
      id: p.id,
      name: p.name,
      creditEnabled: p.creditEnabled,
      creditLimitPaise: p.creditLimitPaise,
      currentOutstandingPaise: totalDebit - totalCredit,
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/van"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Van Sales Counter</h1>
            <p className="text-xs text-slate-400">
              {van.name} • Load Sheet #{stockSummary.activeVanDay.issueSheetNo}
            </p>
          </div>
        </div>

        <Link
          href="/van/bills"
          className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
        >
          View Invoices
        </Link>
      </div>

      <VanBillingClient
        vanId={van.id}
        vanName={van.name}
        issueSheetNo={stockSummary.activeVanDay.issueSheetNo}
        products={billingProducts}
        parties={partyOptions}
        currentUserRole={session.user.role}
        currentUserId={session.user.id}
      />
    </div>
  );
}

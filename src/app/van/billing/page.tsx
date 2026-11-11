import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { VanBillingClient } from "./van-billing-client";
import { tHi } from "@/lib/i18n/messages/hi";

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
            <h1 className="text-xl font-black text-white">{tHi("vanBillingTitle")}</h1>
            <p className="text-sm text-slate-400">
              {tHi("vanBillingSubtitle", { van: van ? van.name : tHi("unassignedVan") })}
            </p>
          </div>
        </div>

        <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-6 text-center text-amber-200 space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="font-bold text-lg text-white">{tHi("morningLoadRequiredTitle")}</h3>
          <p className="text-sm text-amber-300/90 max-w-md mx-auto">
            {!van
              ? tHi("noVanAssignedMsg")
              : tHi("morningLoadRequiredDesc", { van: van.name })}
          </p>
          <div className="pt-2">
            <Link
              href="/van"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold"
            >
              {tHi("backToVan")}
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

  // Morning Load sheet items mapping
  const morningLoadedLines = stockSummary.activeVanDay.lines || [];
  const morningLoadedMap = new Map(morningLoadedLines.map((l) => [l.productId, l]));

  // Do not filter out products based on stock quantity (stock should not block van counter billing)
  const loadedInventory = stockSummary.inventory.filter(
    (item) => morningLoadedMap.size === 0 || morningLoadedMap.has(item.product.id)
  );

  const billingProducts = loadedInventory
    .map((item) => {
      const loadLine = morningLoadedMap.get(item.product.id);
      return {
        id: item.product.id,
        name: item.product.name,
        nameHi: item.product.nameHi ?? null,
        shortCode: item.product.shortCode,
        weight: item.product.weight?.trim() || null,
        packSize: item.product.packSize,
        packLabel: item.product.packLabel,
        mrpPaise: item.product.mrpPaise ?? item.product.priceCPaise ?? 0,
        priceAPaise: item.product.priceAPaise ?? null,
        priceBPaise: item.product.priceBPaise ?? null,
        priceCPaise: item.product.priceCPaise ?? null,
        availablePieces: item.qty,
        cartons: item.cartons,
        loosePieces: item.loosePieces,
        companyName: companyMap.get(item.product.id) || "General",
        morningIssuedQty: loadLine?.issuedQty ?? item.qty,
        morningSoldQty: loadLine?.soldQty ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Fetch active customer parties and their live balances
  const parties = await prisma.party.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      nameHi: true,
      type: true,
      phone: true,
      address: true,
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
      nameHi: p.nameHi ?? null,
      type: p.type,
      phone: p.phone,
      address: p.address,
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
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900">{tHi("vanBillingTitle")}</h1>
            <p className="text-sm text-slate-500">
              {tHi("loadSheetBadge", { van: van.name, sheet: stockSummary.activeVanDay.issueSheetNo })}
            </p>
          </div>
        </div>

        <Link
          href="/van/bills"
          className="text-sm font-bold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs"
        >
          {tHi("todaysBillsLink")}
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

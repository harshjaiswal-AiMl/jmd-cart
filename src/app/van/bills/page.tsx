import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ReceiptText, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

import { VanBillsClient, SerializedVanInvoice } from "./van-bills-client";
import { tHi } from "@/lib/i18n/messages/hi";

export default async function VanBillsPage() {
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

  // Fetch recent invoices issued from this van location
  const rawInvoices = van
    ? await prisma.invoice.findMany({
        where: { locationId: van.id },
        include: { party: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const serializedInvoices: SerializedVanInvoice[] = rawInvoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    paymentStatus: inv.paymentStatus,
    totalPaise: inv.totalPaise,
    createdAt: inv.createdAt.toISOString(),
    party: inv.party
      ? {
          id: inv.party.id,
          name: inv.party.name,
          nameHi: inv.party.nameHi ?? null,
          phone: inv.party.phone,
        }
      : null,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/van"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">{tHi("vanInvoicesRegisterHeading")}</h1>
          <p className="text-sm text-slate-400">
            {tHi("vanInvoicesRegisterSub", { van: van ? van.name : tHi("unassignedVan") })}
          </p>
        </div>
      </div>

      <VanBillsClient
        invoices={serializedInvoices}
        vanName={van ? van.name : "Unassigned Van"}
      />
    </div>
  );
}

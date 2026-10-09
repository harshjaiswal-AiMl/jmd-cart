import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { partyService } from "@/modules/party/party.service";
import {
  VanCollectionsClient,
  SerializedParty,
  SerializedCollection,
} from "./van-collections-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VanCollectionsPage() {
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

  // 1. Identify active assigned van
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

  // 2. Fetch all parties with live outstanding balance
  const { parties: rawParties } = await partyService.searchParties(
    session.user.role as UserRole,
    { limit: 100, activeOnly: true }
  );

  const serializedParties: SerializedParty[] = rawParties.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    address: p.address,
    type: p.type,
    creditEnabled: p.creditEnabled,
    creditLimitPaise: p.creditLimitPaise,
    outstandingPaise: p.outstandingPaise,
  }));

  // 3. Fetch recent collection receipts for today
  const rawCollections = await partyService.getRecentCollections(
    session.user.role as UserRole,
    { vanLocationId: van?.id, actorId: session.user.id, limit: 30 }
  );

  const serializedCollections: SerializedCollection[] = rawCollections.map((c) => ({
    id: c.id,
    receiptNo: c.receiptNo,
    partyId: c.partyId,
    partyName: c.partyName,
    partyPhone: c.partyPhone,
    amountPaise: c.amountPaise,
    mode: c.mode,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
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
          <h1 className="text-xl font-black text-white">Route Collections</h1>
          <p className="text-xs text-slate-400">
            {van ? van.name : "Unassigned Van"} • Retailer Outstanding & Receipts
          </p>
        </div>
      </div>

      <VanCollectionsClient
        parties={serializedParties}
        recentCollections={serializedCollections}
        vanLocationId={van ? van.id : null}
        vanName={van ? van.name : "Van Sales"}
      />
    </div>
  );
}

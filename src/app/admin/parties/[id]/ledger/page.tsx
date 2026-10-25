import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { partyService } from "@/modules/party/party.service";
import { PartyLedgerClient } from "./party-ledger-client";

export const dynamic = "force-dynamic";

interface AdminPartyLedgerPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ startDate?: string; endDate?: string }>;
}

export default async function AdminPartyLedgerPage({
  params,
  searchParams,
}: AdminPartyLedgerPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ACCOUNTS) {
    redirect("/login");
  }

  const { id } = await params;
  const search = await searchParams;

  const startDate = search?.startDate ? new Date(search.startDate) : undefined;
  const endDate = search?.endDate ? new Date(search.endDate) : undefined;

  try {
    const statement = await partyService.getPartyLedgerStatement(session.user.role, {
      partyId: id,
      startDate,
      endDate,
    });

    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <PartyLedgerClient initialStatement={statement} partyId={id} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Failed to load party ledger statement:", error);
    notFound();
  }
}

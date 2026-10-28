import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, PartyType } from "@prisma/client";
import { partyService } from "@/modules/party/party.service";
import { PartiesClient } from "./parties-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPartiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string; creditOnly?: string; page?: string; limit?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ACCOUNTS) {
    redirect("/login");
  }

  const params = await searchParams;
  const q = params?.q?.trim() || undefined;
  const creditOnly = params?.creditOnly === "true";

  let type: PartyType | undefined = undefined;
  if (params?.type && Object.values(PartyType).includes(params.type as PartyType)) {
    type = params.type as PartyType;
  }

  // 100 per page pagination
  const page = Math.max(1, parseInt(params?.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(params?.limit || "100", 10) || 100));
  const offset = (page - 1) * limit;

  const { parties, total } = await partyService.searchParties(session.user.role, {
    q,
    type,
    creditOnly: creditOnly ? true : undefined,
    limit,
    offset,
    activeOnly: false,
  });

  const typeLabels: Record<PartyType, { singular: string; plural: string }> = {
    [PartyType.CUSTOMER]: { singular: "Customer", plural: "Customers" },
    [PartyType.RETAILER]: { singular: "Retailer", plural: "Retailers" },
    [PartyType.WHOLESALER]: { singular: "Wholesaler", plural: "Wholesalers" },
    [PartyType.SUPPLIER]: { singular: "Supplier", plural: "Suppliers" },
  };

  const currentTypeMeta = type ? typeLabels[type] : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link href="/admin" className="hover:underline">
                Admin
              </Link>
              <span>/</span>
              <span>{currentTypeMeta ? currentTypeMeta.plural : "Parties & Credit"}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentTypeMeta ? `${currentTypeMeta.singular} Master` : "Party & Credit Master"}
            </h1>
            <p className="text-sm text-gray-600">
              Manage customers, retailers, wholesalers, suppliers, credit terms, and live ledger balances.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/parties/import"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              📥 Import from Tally
            </Link>
          </div>
        </div>

        <PartiesClient
          initialParties={parties}
          totalCount={total}
          currentPage={page}
          pageSize={limit}
          currentType={params?.type || "ALL"}
          currentSearch={params?.q || ""}
          currentCreditOnly={creditOnly}
        />
      </div>
    </div>
  );
}

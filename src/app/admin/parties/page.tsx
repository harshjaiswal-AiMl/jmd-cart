import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { partyService } from "@/modules/party/party.service";
import { PartiesClient } from "./parties-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPartiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string; creditOnly?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ACCOUNTS) {
    redirect("/login");
  }

  const params = await searchParams;
  const q = params?.q;
  const creditOnly = params?.creditOnly === "true";

  const { parties, total } = await partyService.searchParties(session.user.role, {
    q,
    creditOnly,
    limit: 100,
    activeOnly: false,
  });

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
              <span>Parties & Credit</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Party & Credit Master</h1>
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

        <PartiesClient initialParties={parties} totalCount={total} />
      </div>
    </div>
  );
}

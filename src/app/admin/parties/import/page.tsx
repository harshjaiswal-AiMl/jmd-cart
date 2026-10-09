import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { PartyImportClient } from "./party-import-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPartyImportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ACCOUNTS) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            <span>/</span>
            <Link href="/admin/parties" className="hover:underline">
              Parties
            </Link>
            <span>/</span>
            <span>Tally Import</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Import Parties from Tally</h1>
          <p className="text-sm text-gray-600">
            Bulk import customer & supplier ledgers, credit limits, credit terms, and opening balances.
          </p>
        </div>

        <PartyImportClient />
      </div>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CatalogImportClient } from "./import-client";

export default async function AdminCatalogImportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Product Master</h1>
          <p className="text-sm text-gray-600">
            Bulk import catalog products from CSV or Tally exports with automated validation and error diagnosis.
          </p>
        </div>

        <CatalogImportClient />
      </div>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CatalogImportClient } from "./import-client";

export default async function AdminCatalogImportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN
  ) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#FEFDF7] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Import Brand Catalog &amp; A/B/C Price Sheets
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Upload multi-sheet Excel (<code>.xlsx</code>) or <code>.csv</code> brand price lists
            (Absolute ₹ or % off MRP) with duplicate review, suspicious row detection, and atomic commit.
          </p>
        </div>

        <CatalogImportClient />
      </div>
    </div>
  );
}

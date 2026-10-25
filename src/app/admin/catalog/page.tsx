import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { catalogService } from "@/modules/catalog/catalog.service";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; companyId?: string; categoryId?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.GODOWN &&
    session.user.role !== UserRole.WAREHOUSE_MANAGER
  ) {
    redirect("/login");
  }

  const params = await searchParams;
  const q = params?.q;
  const companyId = params?.companyId;
  const categoryId = params?.categoryId;

  const [{ products }, companies, categories] = await Promise.all([
    catalogService.searchProducts(session.user.role, {
      q,
      companyId,
      categoryId,
      limit: 1000,
      activeOnly: false,
    }),
    catalogService.listCompanies(session.user.role),
    catalogService.listCategories(session.user.role),
  ]);

  const isReadOnly = session.user.role === UserRole.GODOWN;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Catalog Master</h1>
            <p className="text-sm text-gray-600">
              Manage FMCG products, Qty in Case (pack sizes), MRP, and A/B/C price lists.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/catalog/data-quality"
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            >
              <span>⚠ Data-Quality Audit</span>
            </Link>
            <Link
              href="/admin/catalog/price-lists"
              className="px-3.5 py-2 rounded-xl bg-[#790E11] hover:bg-[#5E0A0D] text-white font-bold text-xs shadow-sm transition"
            >
              Price Lists
            </Link>
          </div>
        </div>


        <CatalogClient
          initialProducts={products}
          companies={companies}
          categories={categories}
          readOnly={isReadOnly}
        />
      </div>
    </div>
  );
}

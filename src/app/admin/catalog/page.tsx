import { auth } from "@/auth";
import { redirect } from "next/navigation";
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

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.GODOWN) {
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
      limit: 100,
      activeOnly: false,
    }),
    catalogService.listCompanies(session.user.role),
    catalogService.listCategories(session.user.role),
  ]);


  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog Master</h1>
          <p className="text-sm text-gray-600">
            Manage FMCG products, pack sizes, MRP, HSN codes, and GST rates.
          </p>
        </div>

        <CatalogClient
          initialProducts={products}
          companies={companies}
          categories={categories}
        />
      </div>
    </div>
  );
}

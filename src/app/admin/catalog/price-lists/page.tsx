import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { catalogService } from "@/modules/catalog/catalog.service";
import { settingsService } from "@/modules/settings/settings.service";
import { CatalogClient } from "../catalog-client";
import { PriceListSettingsToggle } from "./price-list-settings-toggle";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPriceListsPage({
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
    session.user.role !== UserRole.ADMIN
  ) {
    redirect("/login");
  }

  const params = await searchParams;
  const q = params?.q;
  const companyId = params?.companyId;
  const categoryId = params?.categoryId;

  const [{ products }, companies, categories, pricingSettings] = await Promise.all([
    catalogService.searchProducts(session.user.role, {
      q,
      companyId,
      categoryId,
      limit: 100,
      activeOnly: false,
    }),
    catalogService.listCompanies(session.user.role),
    catalogService.listCategories(session.user.role),
    settingsService.getPricingSettings(),
  ]);

  return (
    <div className="min-h-screen bg-[#FEFDF7] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              A / B / C Price Lists &amp; Margins
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              <strong>List A</strong> = Wholesaler (lowest) • <strong>List B</strong> = Retailer •{" "}
              <strong>List C</strong> = Customer / Walk-in / Anonymous Storefront (highest, ≤ MRP).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/pricing"
              className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Quantity Slabs →
            </Link>
            <Link
              href="/admin/catalog/import"
              className="px-3.5 py-2 rounded-lg bg-[#790E11] text-white text-xs font-bold hover:bg-[#5E0A0D]"
            >
              📥 Import Brand Price Sheet
            </Link>
          </div>
        </div>

        <PriceListSettingsToggle
          initialEnabled={pricingSettings.enableQuantityTierPricing}
        />

        <CatalogClient
          initialProducts={products}
          companies={companies}
          categories={categories}
          readOnly={false}
        />
      </div>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pricingService } from "@/modules/pricing/pricing.service";
import { PricingClient } from "./pricing-client";

export default async function AdminPricingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  const [slabs, companies, categories, products] = await Promise.all([
    pricingService.getSlabs(),
    prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Engine & Quantity Slabs</h1>
          <p className="text-sm text-gray-600">
            Define dynamic quantity discount slabs off MRP and automatic buyer classification (Retailer / Wholesaler).
          </p>
        </div>

        <PricingClient
          initialSlabs={slabs}
          companies={companies}
          categories={categories}
          products={products}
        />
      </div>
    </div>
  );
}

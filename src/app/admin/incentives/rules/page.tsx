import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IncentivesNavTabs } from "@/components/incentives/incentives-nav-tabs";
import { IncentiveRulesClient } from "./rules-client";

export const dynamic = "force-dynamic";

export default async function IncentiveRulesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const role = session.user.role;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    redirect("/login");
  }

  // Fetch rules with relations
  const rules = await prisma.incentiveRule.findMany({
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    include: {
      agentUser: { select: { id: true, name: true, agentCode: true } },
      company: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, shortCode: true } },
    },
  });

  // Fetch options for creation dropdowns
  const agents = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, agentCode: true, role: true },
    orderBy: { name: "asc" },
  });

  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const categories = await prisma.category.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, shortCode: true, mrpPaise: true },
    take: 300,
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Commission Rules & Cascade Simulator</h1>
          <p className="text-xs text-stone-500">
            Define commission percentages across agents, brands, categories and products. Precedence order is strictly enforced.
          </p>
        </div>
      </div>

      <IncentivesNavTabs />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <IncentiveRulesClient
          rules={rules}
          agents={agents}
          companies={companies}
          categories={categories}
          products={products}
        />
      </div>
    </div>
  );
}

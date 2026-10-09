import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OperationsClient } from "./operations-client";

export default async function GodownOperationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.GODOWN) {
    redirect("/login");
  }

  const [locations, products] = await Promise.all([
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, shortCode: true, packSize: true, packLabel: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Godown Operations</h1>
          <p className="text-sm text-gray-600">
            Execute internal stock movements, carton breaks, damage deductions, and manual adjustments.
          </p>
        </div>

        <OperationsClient locations={locations} products={products} />
      </div>
    </div>
  );
}

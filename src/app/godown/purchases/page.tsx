import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, PartyType } from "@prisma/client";
import { purchaseService } from "@/modules/purchase/purchase.service";
import { prisma } from "@/lib/prisma";
import { PurchasesClient } from "./purchases-client";

export default async function PurchasesListPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  if (
    role !== UserRole.SUPER_ADMIN &&
    role !== UserRole.ADMIN &&
    role !== UserRole.WAREHOUSE_MANAGER &&
    role !== UserRole.GODOWN
  ) {
    redirect("/login");
  }

  const [{ purchases }, suppliers] = await Promise.all([
    purchaseService.listPurchases(role, { limit: 100 }),
    prisma.party.findMany({
      where: { type: PartyType.SUPPLIER, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PurchasesClient
          purchases={purchases as any}
          suppliers={suppliers}
          userRole={session.user.role}
        />
      </div>
    </div>
  );
}

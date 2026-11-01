import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StockCorrectionsClient } from "./stock-corrections-client";

export const dynamic = "force-dynamic";

export default async function StockCorrectionsReportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  const isAuthorized =
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.ACCOUNTS;

  if (!isAuthorized) {
    redirect("/login");
  }

  const corrections = await prisma.stockCorrection.findMany({
    include: {
      product: {
        select: { id: true, name: true, shortCode: true },
      },
      location: {
        select: { id: true, name: true },
      },
      user: {
        select: { id: true, name: true, role: true },
      },
      reviewer: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Corrections at Billing</h1>
          <p className="text-sm text-gray-600">
            Audit log of all on-the-spot stock adjustments performed by cashiers during voucher billing.
          </p>
        </div>

        <StockCorrectionsClient corrections={corrections as any} />
      </div>
    </div>
  );
}

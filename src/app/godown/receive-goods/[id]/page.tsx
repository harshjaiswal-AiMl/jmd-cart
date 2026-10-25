import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { receivingService } from "@/modules/ocr/receiving.service";
import { ReceiveGoodsClient } from "./receive-goods-client";

export default async function ReceiveGoodsDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.role, Permission.STOCK_VIEW)) redirect("/login");

  const [scan, products] = await Promise.all([
    receivingService.getScan(session.user.role, params.id),
    prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        shortCode: true,
        packSize: true,
        packLabel: true,
        mrpPaise: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6">
      <div className="max-w-7xl mx-auto">
        <ReceiveGoodsClient
          scan={scan as any}
          availableProducts={products}
        />
      </div>
    </div>
  );
}

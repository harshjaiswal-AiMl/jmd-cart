import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType, PartyType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ReturnForm } from "./return-form";

export const dynamic = "force-dynamic";

export default async function NewReturnPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  if (
    role !== UserRole.SUPER_ADMIN &&
    role !== UserRole.GODOWN &&
    role !== UserRole.ACCOUNTS
  ) {
    redirect("/login");
  }

  const [suppliers, locations, products] = await Promise.all([
    prisma.party.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        gstin: true,
        phone: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: {
        active: true,
        type: LocationType.GODOWN,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true },
      include: {
        company: { select: { name: true } },
        stockBalances: {
          select: {
            locationId: true,
            qty: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <ReturnForm
          suppliers={suppliers}
          locations={locations}
          products={products}
        />
      </div>
    </div>
  );
}

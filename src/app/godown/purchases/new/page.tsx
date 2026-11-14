import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { purchaseService } from "@/modules/purchase/purchase.service";
import { PurchaseForm } from "./purchase-form";

export default async function NewPurchasePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.GODOWN
  ) {
    redirect("/login");
  }

  const { suppliers, locations, products } = await purchaseService.getFormData(session.user.role);
  const normalizedProducts = products.map((p) => ({
    ...p,
    mrpPaise: p.mrpPaise ?? 0,
  }));

  return (
    <div className="w-full h-full min-h-[calc(100vh-64px)] bg-slate-100">
      <PurchaseForm
        suppliers={suppliers}
        locations={locations}
        products={normalizedProducts}
      />
    </div>
  );
}

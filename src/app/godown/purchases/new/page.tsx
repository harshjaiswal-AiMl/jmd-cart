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

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.GODOWN) {
    redirect("/login");
  }

  const { suppliers, locations, products } = await purchaseService.getFormData(session.user.role);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <PurchaseForm
          suppliers={suppliers}
          locations={locations}
          products={products}
        />
      </div>
    </div>
  );
}

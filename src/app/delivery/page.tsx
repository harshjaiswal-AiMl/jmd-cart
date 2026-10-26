import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, OrderStatus } from "@prisma/client";
import { orderService } from "@/modules/order/order.service";
import { DeliveryClient } from "./delivery-client";

export default async function DeliveryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.DELIVERY &&
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.SALESPERSON
  ) {
    redirect("/login");
  }

  // Fetch orders
  let orders = [];
  if (session.user.role === UserRole.DELIVERY || session.user.role === UserRole.SALESPERSON) {
    orders = await orderService.listOrdersForDelivery(session.user.id);
  } else {
    // SUPER_ADMIN sees all assigned orders or active dispatch orders
    orders = await orderService.listAllOrders();
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <DeliveryClient
        orders={orders}
        currentUserId={session.user.id}
        userRole={session.user.role}
      />
    </div>
  );
}

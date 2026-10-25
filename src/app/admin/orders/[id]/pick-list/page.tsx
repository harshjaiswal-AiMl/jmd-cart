import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { orderService } from "@/modules/order/order.service";
import { PickListClientView } from "./pick-list-client-view";

export default async function SplitPickListPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Allowed for Super Admin, Godown, and Shop roles
  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.GODOWN &&
    session.user.role !== UserRole.SHOP
  ) {
    redirect("/store");
  }

  const pickLists = await orderService.getSplitPickLists(params.id);

  if (!pickLists) {
    notFound();
  }

  return <PickListClientView pickLists={pickLists} orderId={params.id} />;
}

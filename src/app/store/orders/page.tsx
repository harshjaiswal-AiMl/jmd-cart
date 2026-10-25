import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function BuyerOrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/account?tab=orders");
  }

  redirect("/store/account?tab=orders");
}

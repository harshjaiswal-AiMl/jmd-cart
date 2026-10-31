import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { diwaliService } from "@/modules/diwali/diwali.service";
import { catalogService } from "@/modules/catalog/catalog.service";
import { DiwaliAdminClient } from "./diwali-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminDiwaliPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/diwali");
  }

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    redirect("/admin");
  }

  const [config, { products }, categories] = await Promise.all([
    diwaliService.getConfig(),
    catalogService.searchProducts(role, { limit: 1000, activeOnly: true }),
    catalogService.listCategories(role),
  ]);

  return (
    <DiwaliAdminClient
      initialConfig={config}
      availableProducts={products}
      categories={categories}
    />
  );
}

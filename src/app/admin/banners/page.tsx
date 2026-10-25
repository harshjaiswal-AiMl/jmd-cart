import { auth } from "@/auth";
import { bannerService } from "@/modules/banners/banner.service";
import { BannersClient } from "./banners-client";
import { redirect } from "next/navigation";

export default async function AdminBannersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/banners");
  }

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    redirect("/admin");
  }

  const banners = await bannerService.getBanners();

  return <BannersClient initialBanners={banners} />;
}

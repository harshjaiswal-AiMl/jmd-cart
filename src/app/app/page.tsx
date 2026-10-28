import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDefaultAppForRole } from "@/modules/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AppRootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const destination = getDefaultAppForRole(session.user.role as any);
  redirect(destination);
}

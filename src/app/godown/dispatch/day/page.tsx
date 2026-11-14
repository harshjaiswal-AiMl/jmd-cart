import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { dayDispatchService } from "@/modules/dispatch/day-dispatch.service";
import { DayDispatchClient } from "./day-dispatch-client";

interface PageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function DayDispatchPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  const isAuthorized =
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.WAREHOUSE_MANAGER ||
    role === UserRole.GODOWN ||
    hasPermission(role, Permission.STOCK_VIEW) ||
    hasPermission(role, Permission.DISPATCH_MANAGE);

  if (!isAuthorized) {
    redirect("/login");
  }

  const { date } = await searchParams;
  const initialData = await dayDispatchService.getDayDispatchData(role, date);

  return <DayDispatchClient initialData={initialData} />;
}

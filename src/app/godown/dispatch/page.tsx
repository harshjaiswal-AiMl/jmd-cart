import React from "react";
import { redirect } from "next/navigation";
import { LocationType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { dispatchService } from "@/modules/dispatch/dispatch.service";
import { DispatchClient } from "./dispatch-client";

export default async function DispatchBoardPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    redirect("/login?next=/godown/dispatch");
  }

  // Allowed roles per Section 4: SUPER_ADMIN, ADMIN, WAREHOUSE_MANAGER, GODOWN
  if (
    user.role !== UserRole.SUPER_ADMIN &&
    user.role !== UserRole.ADMIN &&
    user.role !== UserRole.WAREHOUSE_MANAGER &&
    user.role !== UserRole.GODOWN
  ) {
    redirect("/unauthorized");
  }

  const [boardData, vans, deliveryStaff] = await Promise.all([
    dispatchService.getDispatchBoardData(),
    prisma.location.findMany({
      where: { type: LocationType.VAN, active: true },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: UserRole.DELIVERY, active: true },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <DispatchClient
        boardData={boardData}
        vans={vans}
        deliveryStaff={deliveryStaff}
        userRole={user.role}
      />
    </div>
  );
}

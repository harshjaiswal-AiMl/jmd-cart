import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { vanService } from "@/modules/van/van.service";
import { GodownVanReconcileClient } from "./reconcile-client";

interface PageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export default async function GodownVanReconcilePage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.GODOWN &&
    session.user.role !== UserRole.SUPER_ADMIN
  ) {
    redirect("/godown/van-issues");
  }

  try {
    const report = await vanService.getVanReconciliation(
      session.user.role,
      params.id
    );

    const initialHandover = await vanService.getCashHandoverByVanDay(
      session.user.role,
      params.id
    );

    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <GodownVanReconcileClient
          initialReport={report}
          initialHandover={initialHandover}
          userRole={session.user.role}
        />
      </div>
    );
  } catch {
    notFound();
  }
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RolesMatrixClient } from "./roles-matrix-client";

export const dynamic = "force-dynamic";

export default async function RolesMatrixPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    redirect("/login");
  }

  // Count users per role
  const users = await prisma.user.groupBy({
    by: ["role"],
    _count: { id: true },
  });

  const userCounts: Record<string, number> = {};
  for (const u of users) {
    userCounts[u.role] = u._count.id;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles &amp; Permissions Matrix</h1>
          <p className="text-sm text-gray-600">
            Explicit matrix of permissions across system roles, field-level access rules, and audit changes.
          </p>
        </div>

        <RolesMatrixClient userRole={role} userCounts={userCounts} />
      </div>
    </div>
  );
}

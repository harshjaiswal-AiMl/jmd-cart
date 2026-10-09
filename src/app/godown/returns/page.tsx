import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { returnsService } from "@/modules/returns/returns.service";
import { ReturnsClient } from "./returns-client";

interface PageProps {
  searchParams: {
    tab?: "notes" | "stock-wise";
  };
}

export const dynamic = "force-dynamic";

export default async function ReturnsListPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  if (
    role !== UserRole.SUPER_ADMIN &&
    role !== UserRole.GODOWN &&
    role !== UserRole.ACCOUNTS
  ) {
    redirect("/login");
  }

  const [{ items: debitNotes, totalCount }, stockWiseReport] =
    await Promise.all([
      returnsService.listDebitNotes(role, { limit: 50 }),
      returnsService.getStockWiseReturnReport(role),
    ]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <ReturnsClient
          debitNotes={debitNotes}
          totalCount={totalCount}
          stockWiseReport={stockWiseReport}
          initialTab={searchParams.tab || "notes"}
        />
      </div>
    </div>
  );
}

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
    role !== UserRole.ADMIN &&
    role !== UserRole.WAREHOUSE_MANAGER &&
    role !== UserRole.GODOWN &&
    role !== UserRole.ACCOUNTS
  ) {
    redirect("/login");
  }

  let debitNotes: any[] = [];
  let totalCount = 0;
  let stockWiseReport: any = {
    totalItemsReturned: 0,
    totalValuationPaise: 0,
    totalDebitNotesCount: 0,
    rows: [],
    asOfDate: "",
  };

  try {
    const [notesRes, reportRes] = await Promise.all([
      returnsService.listDebitNotes(role, { limit: 50 }),
      returnsService.getStockWiseReturnReport(role),
    ]);
    debitNotes = notesRes.items || [];
    totalCount = notesRes.totalCount || 0;
    stockWiseReport = reportRes || stockWiseReport;
  } catch (err) {
    console.error("Error loading returns data:", err);
  }

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

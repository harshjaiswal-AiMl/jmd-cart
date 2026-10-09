import { auth } from "@/auth";
import { reportsService } from "@/modules/reports/reports.service";
import { getISTDateString } from "@/lib/date";
import { UserRole } from "@prisma/client";
import { ReportsClient } from "./reports-client";

interface ReportsPageProps {
  searchParams: Promise<{
    tab?: string;
    date?: string;
    channel?: string;
    threshold?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { tab, date } = await searchParams;
  const session = await auth();
  const role = session?.user?.role || UserRole.SUPER_ADMIN;

  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : getISTDateString();

  const activeTab =
    tab === "cash" || tab === "stock" || tab === "lowstock"
      ? tab
      : "sales";

  const [salesData, cashData, stockData, lowStockData] = await Promise.all([
    reportsService.getDailySalesReport(role, { date: selectedDate }),
    reportsService.getDayEndCashReport(role, selectedDate),
    reportsService.getStockValuationReport(role),
    reportsService.getLowStockReport(role),
  ]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <ReportsClient
        initialTab={activeTab}
        selectedDate={selectedDate}
        salesData={salesData}
        cashData={cashData}
        stockData={stockData}
        lowStockData={lowStockData}
        locationsList={stockData.locationsList}
      />
    </div>
  );
}

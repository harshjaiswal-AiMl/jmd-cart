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
    tab === "cash" ||
    tab === "stock" ||
    tab === "lowstock" ||
    tab === "ageing" ||
    tab === "gst" ||
    tab === "daybook" ||
    tab === "tally"
      ? tab
      : "sales";

  const [salesData, cashData, stockData, lowStockData, ageingData, gstr1Data, dayBookData] = await Promise.all([
    reportsService.getDailySalesReport(role, { date: selectedDate }).catch(() => ({
      date: selectedDate,
      invoiceCount: 0,
      cancelledCount: 0,
      totalUnitsSold: 0,
      grossSubtotalPaise: 0,
      totalDiscountPaise: 0,
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      roundOffPaise: 0,
      netSalesPaise: 0,
      paymentsByMode: [],
      taxSummary: [],
      topProducts: [],
      invoices: [],
    })),
    reportsService.getDayEndCashReport(role, selectedDate).catch(() => ({
      date: selectedDate,
      totalCashPaise: 0,
      transactionsCount: 0,
      transactions: [],
    })),
    reportsService.getStockValuationReport(role).catch(() => ({
      totalProducts: 0,
      totalUnits: 0,
      totalCartons: 0,
      totalValuationPaise: 0,
      locationsList: [],
      items: [],
    })),
    reportsService.getLowStockReport(role).catch(() => ({
      totalLowStockCount: 0,
      totalDeficitUnits: 0,
      items: [],
    })),
    reportsService.getPartyAgeingReport(role).catch(() => ({
      asOfDate: selectedDate,
      summary: {
        totalParties: 0,
        partiesWithOutstanding: 0,
        totalReceivablesPaise: 0,
        totalAdvancePaise: 0,
        totalBucket0_15Paise: 0,
        totalBucket16_30Paise: 0,
        totalBucket31_60Paise: 0,
        totalBucket60PlusPaise: 0,
        overLimitCount: 0,
        overLimitTotalPaise: 0,
        overdueCount: 0,
        overdueTotalPaise: 0,
      },
      rows: [],
    })),
    reportsService.getGstr1Report(role, selectedDate.slice(0, 7)).catch(() => ({
      periodMonth: selectedDate.slice(0, 7),
      startDate: `${selectedDate.slice(0, 7)}-01`,
      endDate: `${selectedDate.slice(0, 7)}-31`,
      b2bInvoices: [],
      b2csSummary: [],
      hsnSummary: [],
      rateBreakdown: [],
      totalInvoicesCount: 0,
      totalTaxablePaise: 0,
      totalCgstPaise: 0,
      totalSgstPaise: 0,
      totalIgstPaise: 0,
      totalTaxPaise: 0,
      totalInvoiceValuePaise: 0,
    })),
    reportsService.getDayBookReport(role, selectedDate).catch(() => ({
      date: selectedDate,
      totalDebitPaise: 0,
      totalCreditPaise: 0,
      entriesCount: 0,
      entries: [],
    })),
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
        ageingData={ageingData}
        gstr1Data={gstr1Data}
        dayBookData={dayBookData}
        locationsList={stockData.locationsList}
      />
    </div>
  );
}

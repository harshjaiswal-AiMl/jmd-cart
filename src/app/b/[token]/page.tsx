import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillTokenService } from "@/modules/messaging/bill-token.service";
import { BillViewClient } from "./bill-view-client";

interface PageProps {
  params: {
    token: string;
  };
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Bill • JMD Cart",
  description: "View and print your JMD Cart invoice",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function BillPage({ params }: PageProps) {
  const token = params.token;
  if (!token || token.length < 8) {
    notFound();
  }

  const bill = await BillTokenService.verifyAndGetBill(token);
  if (!bill) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center border border-slate-200">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Invoice Not Found or Expired</h1>
          <p className="text-sm text-slate-600 mb-4">
            This customer bill link is invalid, has expired after 90 days, or was revoked. Please contact JMD Cart for an updated bill.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
          >
            Go to JMD Cart Home
          </a>
        </div>
      </div>
    );
  }

  return <BillViewClient bill={bill} />;
}

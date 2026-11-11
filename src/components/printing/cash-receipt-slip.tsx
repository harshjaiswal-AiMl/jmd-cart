import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { InvoiceViewModelOptions } from "@/modules/billing/invoice-view-model";
import { BillDocument } from "./bill-document";

export interface CashReceiptSlipProps {
  invoice: InvoiceWithDetails;
  business?: BusinessDetails;
  options?: InvoiceViewModelOptions;
}

export function CashReceiptSlip({ invoice, business, options }: CashReceiptSlipProps) {
  return (
    <BillDocument
      invoice={invoice}
      business={business}
      variant="thermal"
      options={options}
    />
  );
}

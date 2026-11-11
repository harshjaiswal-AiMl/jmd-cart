import React from "react";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { BillDocument } from "./bill-document";

export interface ThermalReceiptProps {
  invoice: InvoiceWithDetails;
  business: BusinessDetails;
}

export function ThermalReceipt({ invoice, business }: ThermalReceiptProps) {
  return (
    <BillDocument
      invoice={invoice}
      business={business}
      variant="thermal"
    />
  );
}

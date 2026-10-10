import { TallySalesVoucher, TallyReceiptVoucher, TallyMasterLedger } from "./tally.types";

/**
 * Escapes special XML characters (&, <, >, ", ').
 */
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formats a Date into standard Tally XML date string (YYYYMMDD).
 */
function toTallyDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

/**
 * Generates official Tally XML (ENVELOPE / BODY / IMPORTDATA / REQUESTDATA / TALLYMESSAGE)
 * compatible with Tally ERP 9 and TallyPrime XML import.
 */
export function buildTallyXml(
  salesVouchers: TallySalesVoucher[],
  receiptVouchers: TallyReceiptVoucher[],
  companyName: string = "JMD Cart Distributors"
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  // 1. Sales Vouchers
  for (const inv of salesVouchers) {
    const tallyDate = toTallyDate(inv.date);
    const totalAmountRs = (inv.totalPaise / 100).toFixed(2);
    const taxableRs = (inv.taxablePaise / 100).toFixed(2);
    const cgstRs = (inv.cgstPaise / 100).toFixed(2);
    const sgstRs = (inv.sgstPaise / 100).toFixed(2);
    const igstRs = (inv.igstPaise / 100).toFixed(2);
    const roundOffRs = (inv.roundOffPaise / 100).toFixed(2);

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(inv.voucherNumber)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${escapeXml(inv.partyName)}</PARTYLEDGERNAME>
            <NARRATION>${escapeXml(inv.narration)}</NARRATION>
            <BASICBUYERNAME>${escapeXml(inv.partyName)}</BASICBUYERNAME>
            <PLACEOFSUPPLY>${escapeXml(inv.placeOfSupply)}</PLACEOFSUPPLY>
            <ISINVOICE>Yes</ISINVOICE>
            
            <!-- Debtor Party Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(inv.partyName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${totalAmountRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Sales Account Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${taxableRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;

    if (inv.cgstPaise > 0) {
      xml += `            <!-- CGST Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgstRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
    }

    if (inv.sgstPaise > 0) {
      xml += `            <!-- SGST Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgstRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
    }

    if (inv.igstPaise > 0) {
      xml += `            <!-- IGST Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${igstRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
    }

    if (inv.roundOffPaise !== 0) {
      xml += `            <!-- Round Off Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Round Off</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${inv.roundOffPaise < 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
              <AMOUNT>${roundOffRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
`;
    }

    // Line items Inventory allocation
    for (const item of inv.items) {
      const itemAmtRs = (item.amountPaise / 100).toFixed(2);
      const itemRateRs = (item.ratePaise / 100).toFixed(2);
      xml += `            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(item.productName)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>${itemRateRs}/${escapeXml(item.unit)}</RATE>
              <ACTUALQTY>${item.qty} ${escapeXml(item.unit)}</ACTUALQTY>
              <BILLEDQTY>${item.qty} ${escapeXml(item.unit)}</BILLEDQTY>
              <AMOUNT>${itemAmtRs}</AMOUNT>
            </ALLINVENTORYENTRIES.LIST>
`;
    }

    xml += `          </VOUCHER>
        </TALLYMESSAGE>
`;
  }

  // 2. Receipt Vouchers
  for (const rec of receiptVouchers) {
    const tallyDate = toTallyDate(rec.date);
    const amountRs = (rec.amountPaise / 100).toFixed(2);

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(rec.voucherNumber)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${escapeXml(rec.partyName)}</PARTYLEDGERNAME>
            <NARRATION>${escapeXml(rec.narration)}</NARRATION>
            
            <!-- Cash/Bank Account (Debit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(rec.mode)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amountRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Customer Account (Credit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(rec.partyName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amountRs}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
`;
  }

  xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml;
}

/**
 * Generates RFC 4180 compliant CSV export format of sales and receipt vouchers.
 */
export function buildTallyCsv(
  salesVouchers: TallySalesVoucher[],
  receiptVouchers: TallyReceiptVoucher[]
): string {
  const headers = [
    "Voucher Type",
    "Voucher No",
    "Date",
    "Party Name",
    "Party GSTIN",
    "Place of Supply",
    "Item Name",
    "Qty",
    "Unit",
    "Rate (Rs)",
    "Taxable (Rs)",
    "CGST (Rs)",
    "SGST (Rs)",
    "IGST (Rs)",
    "Round Off (Rs)",
    "Total (Rs)",
    "Payment Mode",
    "Narration",
  ];

  const rows: string[][] = [];

  // Sales rows
  for (const inv of salesVouchers) {
    if (inv.items.length === 0) {
      rows.push([
        "Sales",
        inv.voucherNumber,
        inv.date,
        `"${inv.partyName}"`,
        inv.partyGstin || "",
        inv.placeOfSupply,
        "",
        "0",
        "",
        "0",
        (inv.taxablePaise / 100).toFixed(2),
        (inv.cgstPaise / 100).toFixed(2),
        (inv.sgstPaise / 100).toFixed(2),
        (inv.igstPaise / 100).toFixed(2),
        (inv.roundOffPaise / 100).toFixed(2),
        (inv.totalPaise / 100).toFixed(2),
        "",
        `"${inv.narration}"`,
      ]);
    } else {
      for (const item of inv.items) {
        rows.push([
          "Sales",
          inv.voucherNumber,
          inv.date,
          `"${inv.partyName}"`,
          inv.partyGstin || "",
          inv.placeOfSupply,
          `"${item.productName}"`,
          item.qty.toString(),
          item.unit,
          (item.ratePaise / 100).toFixed(2),
          (item.amountPaise / 100).toFixed(2),
          (inv.cgstPaise / 100).toFixed(2),
          (inv.sgstPaise / 100).toFixed(2),
          (inv.igstPaise / 100).toFixed(2),
          (inv.roundOffPaise / 100).toFixed(2),
          (inv.totalPaise / 100).toFixed(2),
          "",
          `"${inv.narration}"`,
        ]);
      }
    }
  }

  // Receipt rows
  for (const rec of receiptVouchers) {
    rows.push([
      "Receipt",
      rec.voucherNumber,
      rec.date,
      `"${rec.partyName}"`,
      "",
      "10-Bihar",
      "",
      "0",
      "",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      (rec.amountPaise / 100).toFixed(2),
      rec.mode,
      `"${rec.narration}"`,
    ]);
  }

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

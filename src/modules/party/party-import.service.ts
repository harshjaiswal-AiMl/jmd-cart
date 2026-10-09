import { UserRole, PartyType } from "@prisma/client";
import { parseCsv } from "@/modules/catalog/import/csv-parser";
import { partyRepository } from "./party.repository";
import {
  TallyPartyImportResult,
  TallyPartyRowError,
  CreatePartyInput,
} from "./party.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";

/**
 * Normalizes a header string by lowercasing, stripping punctuation, and trimming spaces.
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Field alias mappings for standard Tally exports.
 */
const TALLY_FIELD_ALIASES: Record<string, keyof CreatePartyInput | "parent"> = {
  // Name
  name: "name",
  partyname: "name",
  party: "name",
  ledgername: "name",
  ledger: "name",
  customername: "name",
  particulars: "name",

  // Type / Parent
  type: "type",
  parent: "parent",
  group: "parent",
  ledgergroup: "parent",
  under: "parent",

  // Phone
  phone: "phone",
  mobile: "phone",
  contact: "phone",
  phonenumber: "phone",
  mobileno: "phone",
  contactno: "phone",

  // Email
  email: "email",
  emailaddress: "email",

  // GSTIN
  gstin: "gstin",
  gst: "gstin",
  gstinuin: "gstin",
  taxnumber: "gstin",
  gstno: "gstin",

  // Address
  address: "address",
  billingaddress: "address",
  location: "address",

  // Credit Enabled
  creditenabled: "creditEnabled",
  creditallowed: "creditEnabled",
  billbybill: "creditEnabled",
  credit: "creditEnabled",

  // Credit Limit
  creditlimit: "creditLimitPaise",
  creditlimitrs: "creditLimitPaise",
  limit: "creditLimitPaise",

  // Credit Days
  creditdays: "creditDays",
  creditperiod: "creditDays",
  days: "creditDays",
  creditterms: "creditDays",
  billcreditperiod: "creditDays",

  // Opening Balance
  openingbalance: "openingOutstandingPaise",
  openingoutstanding: "openingOutstandingPaise",
  openingbalancers: "openingOutstandingPaise",
  balance: "openingOutstandingPaise",
  opening: "openingOutstandingPaise",

  // Tally Ref
  tallyref: "tallyRef",
  guid: "tallyRef",
  alias: "tallyRef",
  tallyid: "tallyRef",
  ledgeralias: "tallyRef",
};

/**
 * Parses a rupee or paise amount string, handling commas, decimals, and Tally Dr / Cr suffixes.
 * Returns integer paise.
 */
export function parseTallyBalanceToPaise(val: string): number {
  if (!val || !val.trim()) return 0;
  const raw = val.trim();

  const isCr = /cr\.?$/i.test(raw);
  const isDr = /dr\.?$/i.test(raw);

  // Remove commas, spaces, currency symbols, and dr/cr suffixes
  const cleaned = raw.replace(/[₹$,\s]/g, "").replace(/cr\.?$/i, "").replace(/dr\.?$/i, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  const paise = Math.round(num * 100);

  // If explicit Cr suffix or negative, it's negative (advance/credit)
  if (isCr) {
    return -Math.abs(paise);
  }
  // If explicit Dr suffix, positive (debit/debtor owes)
  if (isDr) {
    return Math.abs(paise);
  }
  return paise;
}

/**
 * Parses boolean flags from Tally fields (e.g. Yes/No, True/False, 1/0).
 */
function parseBoolean(val: string | undefined): boolean {
  if (!val) return false;
  const clean = val.trim().toLowerCase();
  return ["yes", "y", "true", "1"].includes(clean);
}

export class PartyImportService {
  /**
   * Imports parties from CSV data exported from Tally ERP / Prime.
   * Performs row-by-row validation, reports exact errors, and idempotently upserts records.
   */
  async importTallyParties(
    role: UserRole,
    actorId: string,
    csvContent: string
  ): Promise<TallyPartyImportResult> {
    assertPermission(role, Permission.MANAGE_PARTIES);

    const { headers, rows } = parseCsv(csvContent);

    if (rows.length === 0) {
      return {
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: [{ row: 0, message: "CSV file is empty or contains only headers" }],
      };
    }

    // Map CSV header index to canonical fields
    const headerMap = new Map<number, keyof CreatePartyInput | "parent">();
    headers.forEach((h, idx) => {
      const normalized = normalizeHeader(h);
      const canonical = TALLY_FIELD_ALIASES[normalized];
      if (canonical) {
        headerMap.set(idx, canonical);
      }
    });

    const errors: TallyPartyRowError[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const rawRow of rows) {
      const rowNum = rawRow.rowNumber;
      const rowData: Record<string, string> = {};

      Object.entries(rawRow.data).forEach(([hdr, val]) => {
        const normalized = normalizeHeader(hdr);
        const canonical = TALLY_FIELD_ALIASES[normalized];
        if (canonical) {
          rowData[canonical] = val.trim();
        }
      });

      // 1. Validate Party Name
      const name = rowData.name;
      if (!name || name.length < 2) {
        errors.push({
          row: rowNum,
          column: "Name / Ledger",
          value: name || "",
          message: "Party name is required and must be at least 2 characters",
        });
        continue;
      }

      // 2. Resolve Type / Parent
      let type: PartyType = PartyType.CUSTOMER;
      const parentOrType = (rowData.parent || rowData.type || "").toLowerCase();
      if (
        parentOrType.includes("creditor") ||
        parentOrType.includes("supplier") ||
        parentOrType === "supplier"
      ) {
        type = PartyType.SUPPLIER;
      }

      // 3. Validate Phone
      const phone = rowData.phone || undefined;
      if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        errors.push({
          row: rowNum,
          column: "Phone",
          value: phone,
          message: "Invalid Indian mobile number (must be 10 digits starting with 6-9)",
        });
        continue;
      }

      // 4. Validate GSTIN
      const gstin = rowData.gstin || undefined;
      if (
        gstin &&
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase())
      ) {
        errors.push({
          row: rowNum,
          column: "GSTIN",
          value: gstin,
          message: "Invalid 15-character GSTIN format",
        });
        continue;
      }

      // 5. Parse Credit Limit
      let creditLimitPaise = 0;
      if (rowData.creditLimitPaise) {
        const parsedLimit = parseFloat(rowData.creditLimitPaise.replace(/,/g, ""));
        if (isNaN(parsedLimit) || parsedLimit < 0) {
          errors.push({
            row: rowNum,
            column: "Credit Limit",
            value: rowData.creditLimitPaise,
            message: "Credit limit must be a positive number",
          });
          continue;
        }
        creditLimitPaise = Math.round(parsedLimit * 100);
      }

      // 6. Parse Credit Days
      let creditDays = 0;
      if (rowData.creditDays) {
        const parsedDays = parseInt(rowData.creditDays, 10);
        if (isNaN(parsedDays) || parsedDays < 0 || parsedDays > 365) {
          errors.push({
            row: rowNum,
            column: "Credit Days",
            value: rowData.creditDays,
            message: "Credit days must be between 0 and 365",
          });
          continue;
        }
        creditDays = parsedDays;
      }

      // 7. Parse Credit Enabled
      let creditEnabled = parseBoolean(rowData.creditEnabled);
      if (creditLimitPaise > 0 || creditDays > 0) {
        // Automatically enable credit if a credit limit or terms are specified
        creditEnabled = true;
      }

      // 8. Parse Opening Outstanding Balance
      const openingOutstandingPaise = parseTallyBalanceToPaise(
        rowData.openingOutstandingPaise || ""
      );

      const tallyRef = rowData.tallyRef || undefined;
      const email = rowData.email || undefined;
      const address = rowData.address || undefined;

      // 9. Idempotent Upsert
      try {
        let existing = tallyRef ? await partyRepository.findPartyByTallyRef(tallyRef) : null;
        if (!existing) {
          existing = await partyRepository.findPartyByNameAndPhone(name, phone);
        }

        if (existing) {
          await partyRepository.updateParty({
            id: existing.id,
            name,
            type,
            phone: phone ?? existing.phone ?? undefined,
            email: email ?? existing.email ?? undefined,
            gstin: gstin ? gstin.toUpperCase() : existing.gstin ?? undefined,
            address: address ?? existing.address ?? undefined,
            creditEnabled,
            creditLimitPaise,
            creditDays,
            tallyRef: tallyRef ?? existing.tallyRef ?? undefined,
            openingOutstandingPaise,
          });
          updatedCount++;
        } else {
          await partyRepository.createParty({
            name,
            type,
            phone,
            email,
            gstin: gstin ? gstin.toUpperCase() : undefined,
            address,
            creditEnabled,
            creditLimitPaise,
            creditDays,
            tallyRef,
            openingOutstandingPaise,
            active: true,
          });
          createdCount++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown database error";
        errors.push({
          row: rowNum,
          column: "Database",
          message: msg,
        });
      }
    }

    const result: TallyPartyImportResult = {
      total: rows.length,
      created: createdCount,
      updated: updatedCount,
      failed: errors.length,
      errors,
    };

    await auditService.log({
      actorId,
      action: "PARTY_IMPORT_TALLY",
      entity: "party",
      after: result,
    });

    return result;
  }
}

export const partyImportService = new PartyImportService();

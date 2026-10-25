import { UserRole } from "@prisma/client";
import { partyRepository } from "./party.repository";
import {
  createPartySchema,
  CreatePartyInput,
  updatePartySchema,
  UpdatePartyInput,
  partySearchQuerySchema,
  PartySearchQueryInput,
  PartyWithOutstanding,
  recordCollectionInputSchema,
  RecordCollectionInput,
  CollectionReceipt,
  partyLedgerFilterSchema,
  PartyLedgerFilterInput,
  PartyLedgerStatement,
  PartyCreditStatus,
} from "./party.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";

export class PartyNotFoundError extends Error {
  constructor(id: string) {
    super(`Party '${id}' not found`);
    this.name = "PartyNotFoundError";
  }
}

export class DuplicateTallyRefError extends Error {
  constructor(tallyRef: string) {
    super(`Party with Tally reference '${tallyRef}' already exists`);
    this.name = "DuplicateTallyRefError";
  }
}

export class PartyService {
  async searchParties(
    role: UserRole,
    query: PartySearchQueryInput
  ): Promise<{ parties: PartyWithOutstanding[]; total: number }> {
    assertPermission(role, Permission.VIEW_PARTIES);
    const parsedQuery = partySearchQuerySchema.parse(query);
    return partyRepository.searchParties(parsedQuery);
  }

  async getPartyById(role: UserRole, id: string): Promise<PartyWithOutstanding> {
    assertPermission(role, Permission.VIEW_PARTIES);
    const party = await partyRepository.getPartyById(id);
    if (!party) {
      throw new PartyNotFoundError(id);
    }
    return party;
  }

  async createParty(
    role: UserRole,
    actorId: string,
    input: CreatePartyInput
  ): Promise<PartyWithOutstanding> {
    assertPermission(role, Permission.MANAGE_PARTIES);
    const parsed = createPartySchema.parse(input);

    if (parsed.tallyRef) {
      const existing = await partyRepository.findPartyByTallyRef(parsed.tallyRef);
      if (existing) {
        throw new DuplicateTallyRefError(parsed.tallyRef);
      }
    }

    const party = await partyRepository.createParty(parsed);

    await auditService.log({
      actorId,
      action: "PARTY_CREATE",
      entity: "party",
      entityId: party.id,
      after: party,
    });

    return party;
  }

  async updateParty(
    role: UserRole,
    actorId: string,
    input: UpdatePartyInput
  ): Promise<PartyWithOutstanding> {
    assertPermission(role, Permission.MANAGE_PARTIES);
    const parsed = updatePartySchema.parse(input);

    const existing = await partyRepository.getPartyById(parsed.id);
    if (!existing) {
      throw new PartyNotFoundError(parsed.id);
    }

    if (parsed.tallyRef && parsed.tallyRef !== existing.tallyRef) {
      const withSameRef = await partyRepository.findPartyByTallyRef(parsed.tallyRef);
      if (withSameRef && withSameRef.id !== parsed.id) {
        throw new DuplicateTallyRefError(parsed.tallyRef);
      }
    }

    const updated = await partyRepository.updateParty(parsed);

    await auditService.log({
      actorId,
      action: "PARTY_UPDATE",
      entity: "party",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  async recordCollection(
    role: UserRole,
    actorId: string,
    input: RecordCollectionInput
  ): Promise<CollectionReceipt> {
    assertPermission(role, Permission.RECORD_COLLECTION);
    const parsed = recordCollectionInputSchema.parse(input);

    const receipt = await partyRepository.recordCollection(parsed, actorId);

    await auditService.log({
      actorId,
      action: "COLLECTION_RECORD",
      entity: "payment",
      entityId: receipt.id,
      after: receipt,
    });

    return receipt;
  }

  async getPartyLedgerStatement(
    role: UserRole,
    filter: PartyLedgerFilterInput
  ): Promise<PartyLedgerStatement> {
    assertPermission(role, Permission.VIEW_LEDGER);
    const parsed = partyLedgerFilterSchema.parse(filter);
    return partyRepository.getPartyLedgerStatement(parsed);
  }

  async getRecentCollections(
    role: UserRole,
    filters?: { vanLocationId?: string; actorId?: string; limit?: number }
  ): Promise<CollectionReceipt[]> {
    assertPermission(role, Permission.VIEW_LEDGER);
    return partyRepository.getRecentCollections(filters);
  }

  async getCollectionById(
    role: UserRole,
    receiptId: string
  ): Promise<CollectionReceipt> {
    assertPermission(role, Permission.VIEW_LEDGER);
    const receipt = await partyRepository.getCollectionById(receiptId);
    if (!receipt) {
      throw new Error(`Collection receipt '${receiptId}' not found`);
    }
    return receipt;
  }

  async checkPartyCreditStatus(
    role: UserRole,
    partyId: string,
    additionalDebitPaise: number = 0
  ): Promise<PartyCreditStatus> {
    assertPermission(role, Permission.VIEW_PARTIES);
    return partyRepository.checkPartyCreditStatus(partyId, additionalDebitPaise);
  }

  async ensureSupplierParty(
    company: { id: string; name: string; active?: boolean },
    tx?: import("@prisma/client").Prisma.TransactionClient,
    options?: { oldName?: string }
  ) {
    return ensureSupplierParty(company, tx, options);
  }
}

export async function ensureSupplierParty(
  company: { id: string; name: string; active?: boolean },
  tx?: import("@prisma/client").Prisma.TransactionClient,
  options?: { oldName?: string }
) {
  const { prisma } = await import("@/lib/prisma");
  const { PartyType } = await import("@prisma/client");
  const db = tx ?? prisma;
  const normName = company.name.trim().toUpperCase();

  let party = await db.party.findUnique({
    where: { companyId: company.id },
  });

  if (party) {
    if (options?.oldName && party.name.trim().toUpperCase() === options.oldName.trim().toUpperCase()) {
      party = await db.party.update({
        where: { id: party.id },
        data: {
          name: company.name.trim(),
          ...(company.active !== undefined ? { active: company.active } : {}),
        },
      });
    } else if (company.active !== undefined && party.active !== company.active) {
      party = await db.party.update({
        where: { id: party.id },
        data: { active: company.active },
      });
    }
    return party;
  }

  const existingSuppliers = await db.party.findMany({
    where: {
      type: PartyType.SUPPLIER,
      companyId: null,
    },
  });

  const matching = existingSuppliers.find(
    (s) => s.name.trim().toUpperCase() === normName
  );

  if (matching) {
    return db.party.update({
      where: { id: matching.id },
      data: {
        companyId: company.id,
        ...(company.active !== undefined ? { active: company.active } : {}),
      },
    });
  }

  return db.party.create({
    data: {
      name: company.name.trim(),
      type: PartyType.SUPPLIER,
      companyId: company.id,
      active: company.active !== undefined ? company.active : true,
      creditEnabled: false,
      creditLimitPaise: 0,
      creditDays: 0,
    },
  });
}

export const partyService = new PartyService();

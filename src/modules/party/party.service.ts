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
}

export const partyService = new PartyService();

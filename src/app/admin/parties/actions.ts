"use server";

import { auth } from "@/auth";
import { partyService } from "@/modules/party/party.service";
import { partyImportService } from "@/modules/party/party-import.service";
import {
  CreatePartyInput,
  createPartySchema,
  UpdatePartyInput,
  updatePartySchema,
  TallyPartyImportResult,
} from "@/modules/party/party.types";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createPartyAction(input: CreatePartyInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const validated = createPartySchema.parse(input);
    const party = await partyService.createParty(session.user.role, session.user.id, validated);
    revalidatePath("/admin/parties");
    return { success: true, data: party };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create party";
    return { success: false, error: msg };
  }
}

export async function updatePartyAction(input: UpdatePartyInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const validated = updatePartySchema.parse(input);
    const party = await partyService.updateParty(session.user.role, session.user.id, validated);
    revalidatePath("/admin/parties");
    return { success: true, data: party };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update party";
    return { success: false, error: msg };
  }
}

export async function importPartiesFromTallyAction(
  csvContent: string
): Promise<ActionResult<TallyPartyImportResult>> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const result = await partyImportService.importTallyParties(
      session.user.role,
      session.user.id,
      csvContent
    );
    revalidatePath("/admin/parties");
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to import parties from Tally";
    return { success: false, error: msg };
  }
}

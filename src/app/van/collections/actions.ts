"use server";

import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { partyService } from "@/modules/party/party.service";
import { settingsService } from "@/modules/settings/settings.service";
import {
  RecordCollectionInput,
  recordCollectionInputSchema,
} from "@/modules/party/party.types";

export async function recordCollectionAction(input: RecordCollectionInput) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const validated = recordCollectionInputSchema.parse(input);
    const receipt = await partyService.recordCollection(
      session.user.role as UserRole,
      session.user.id,
      validated
    );

    return {
      success: true,
      receipt: {
        ...receipt,
        createdAt: receipt.createdAt.toISOString(),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record collection";
    return { success: false, error: message };
  }
}

export async function getCollectionForPrintAction(receiptId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const receipt = await partyService.getCollectionById(
      session.user.role as UserRole,
      receiptId
    );
    const business = await settingsService.getBusinessDetails();

    return {
      success: true,
      receipt: {
        ...receipt,
        createdAt: receipt.createdAt.toISOString(),
      },
      business,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch collection receipt";
    return { success: false, error: message };
  }
}

export async function getPartyLedgerAction(
  partyId: string,
  startDateStr?: string,
  endDateStr?: string
) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const statement = await partyService.getPartyLedgerStatement(
      session.user.role as UserRole,
      { partyId, startDate, endDate }
    );

    return {
      success: true,
      statement: {
        ...statement,
        entries: statement.entries.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch party ledger statement";
    return { success: false, error: message };
  }
}

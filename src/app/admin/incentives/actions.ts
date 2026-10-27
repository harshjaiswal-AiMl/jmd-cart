"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { incentiveService } from "@/modules/incentive/incentive.service";
import { incentiveRepository } from "@/modules/incentive/incentive.repository";
import {
  CreateIncentiveRuleInput,
  IncentiveSettings,
  createIncentiveRuleSchema,
  incentiveSettingsSchema,
} from "@/modules/incentive/incentive.types";

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const role = session.user.role;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    throw new Error("Forbidden: Admin access required");
  }
  return session.user;
}

export async function createRuleAction(input: CreateIncentiveRuleInput) {
  await requireAdminSession();
  const parsed = createIncentiveRuleSchema.parse(input);
  const rule = await incentiveRepository.createRule(parsed);
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/rules");
  return { success: true, rule };
}

export async function updateRuleAction(id: string, input: Partial<CreateIncentiveRuleInput>) {
  await requireAdminSession();
  const rule = await incentiveRepository.updateRule(id, input);
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/rules");
  return { success: true, rule };
}

export async function deleteRuleAction(id: string) {
  await requireAdminSession();
  const rule = await incentiveRepository.deleteRule(id);
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/rules");
  return { success: true, rule };
}

export async function testCalculationAction(params: {
  agentUserId?: string;
  productId?: string;
  pricePaise: number;
}) {
  await requireAdminSession();
  const result = await incentiveService.testCalculation({
    agentUserId: params.agentUserId || null,
    productId: params.productId || null,
    baseAmountPaise: params.pricePaise,
  });
  return { success: true, result };
}

export async function saveIncentiveSettingsAction(settings: IncentiveSettings) {
  const user = await requireAdminSession();
  const parsed = incentiveSettingsSchema.parse(settings);
  const updated = await incentiveService.updateSettings(
    parsed,
    user.id,
    user.role as UserRole
  );
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/settings");
  return { success: true, settings: updated };
}

export async function approvePayoutAction(agentUserId: string, period: string) {
  const user = await requireAdminSession();
  const payout = await incentiveService.approvePayout(
    agentUserId,
    period,
    user.id,
    user.role as UserRole
  );
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/statements");
  return { success: true, payout };
}

export async function markPayoutPaidAction(params: {
  agentUserId: string;
  period: string;
  method: string;
  reference?: string;
}) {
  const user = await requireAdminSession();
  const payout = await incentiveService.markPayoutPaid({
    agentUserId: params.agentUserId,
    period: params.period,
    method: params.method,
    reference: params.reference || "N/A",
    actorId: user.id,
    actorRole: user.role as UserRole,
  });
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/statements");
  return { success: true, payout };
}

export async function recordAdjustmentAction(params: {
  agentUserId: string;
  amountPaise: number;
  reason: string;
  period?: string;
}) {
  const user = await requireAdminSession();
  const now = new Date();
  const currentPeriod =
    params.period ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const entry = await incentiveService.recordAdjustment({
    agentUserId: params.agentUserId,
    period: currentPeriod,
    amountPaise: params.amountPaise,
    reason: params.reason,
    actorId: user.id,
    actorRole: user.role as UserRole,
  });
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/ledger");
  revalidatePath("/admin/incentives/statements");
  return { success: true, entry };
}

export async function previewBackfillAction(startDateIso: string) {
  await requireAdminSession();
  const date = new Date(startDateIso);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid start date");
  }
  const preview = await incentiveService.previewBackfill(date);
  return { success: true, preview };
}

export async function applyBackfillAction(startDateIso: string) {
  const user = await requireAdminSession();
  const date = new Date(startDateIso);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid start date");
  }
  const result = await incentiveService.applyBackfill(date, user.id);
  revalidatePath("/admin/incentives");
  revalidatePath("/admin/incentives/ledger");
  return { success: true, result };
}

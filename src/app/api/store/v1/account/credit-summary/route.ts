import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser?.partyId) {
    return NextResponse.json({
      hasCreditAccount: false,
      creditLimitPaise: 0,
      currentBalancePaise: 0,
      availableCreditPaise: 0,
      recentEntries: [],
    });
  }

  const party = await prisma.party.findUnique({
    where: { id: dbUser.partyId },
    include: {
      ledgerEntries: {
        take: 50,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!party) {
    return NextResponse.json({
      hasCreditAccount: false,
      creditLimitPaise: 0,
      currentBalancePaise: 0,
      availableCreditPaise: 0,
      recentEntries: [],
    });
  }

  const creditLimitPaise = party.creditLimitPaise || 0;
  const currentBalancePaise = party.ledgerEntries.reduce(
    (sum, e) => sum + (e.debitPaise - e.creditPaise),
    0
  );
  const availableCreditPaise = Math.max(0, creditLimitPaise - currentBalancePaise);

  return NextResponse.json({
    hasCreditAccount: party.creditEnabled || creditLimitPaise > 0,
    partyName: party.name,
    gstin: party.gstin,
    creditLimitPaise,
    currentBalancePaise,
    availableCreditPaise,
    creditDays: party.creditDays || 0,
    recentEntries: party.ledgerEntries.map((e: any) => ({
      id: e.id,
      date: e.createdAt,
      kind: e.kind,
      debitPaise: e.debitPaise,
      creditPaise: e.creditPaise,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
    })),
  });
}

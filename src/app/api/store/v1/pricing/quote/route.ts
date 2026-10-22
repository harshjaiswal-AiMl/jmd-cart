import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { pricingService } from "@/modules/pricing/pricing.service";
import { BuyerTier } from "@/modules/pricing/pricing.types";
import { apiSuccess, apiError } from "@/lib/api-response";
import { auth } from "@/auth";

const quoteSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      qty: z.number().int().min(1),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;
    const body = await req.json();
    const parsed = quoteSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid quote payload", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    let buyerType: BuyerTier = BuyerTier.CUSTOMER;
    let isApproved = false;
    let partyId: string | null = null;

    if (session?.user?.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { buyerType: true, buyerApproved: true, partyId: true },
      });
      if (dbUser?.buyerApproved && dbUser.buyerType) {
        buyerType = dbUser.buyerType as BuyerTier;
        isApproved = true;
      }
      partyId = dbUser?.partyId ?? null;
    }

    const pricing = await pricingService.calculateOrderPricing({
      items: parsed.data.items,
      partyId,
      buyerType,
      buyerApproved: isApproved,
    });

    return apiSuccess(pricing);
  } catch (err: any) {
    return apiError(err.message || "Failed to calculate pricing quote", 500, "SERVER_ERROR");
  }
}

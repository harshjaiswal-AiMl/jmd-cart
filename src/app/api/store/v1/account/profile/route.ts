import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { prisma } from "@/lib/prisma";
import { MobileAuthService } from "@/modules/mobile/mobile-auth.service";
import { PartyType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      party: true,
      savedAddresses: true,
    },
  });

  return NextResponse.json({
    user: MobileAuthService.sanitizeUser(fullUser),
    party: fullUser?.party || null,
    addressCount: fullUser?.savedAddresses?.length || 0,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, requestedBuyerType, businessName, gstin } = body;

    const updateData: any = {};
    if (typeof name === "string" && name.trim()) updateData.name = name.trim();
    if (typeof email === "string") updateData.email = email.trim() || null;

    // Wholesale / Retailer application request
    if (requestedBuyerType && ["RETAILER_B", "WHOLESALER_A"].includes(requestedBuyerType)) {
      updateData.buyerType = requestedBuyerType as PartyType;
      // Stays unapproved until admin verification
      updateData.buyerApproved = false;

      // Link or create party if GSTIN provided
      if (gstin && typeof gstin === "string" && gstin.trim().length >= 15) {
        const cleanGstin = gstin.trim().toUpperCase();
        let party = await prisma.party.findFirst({
          where: { gstin: cleanGstin },
        });

        if (!party) {
          party = await prisma.party.create({
            data: {
              name: businessName || name || user.name,
              gstin: cleanGstin,
              phone: user.phone,
              type: requestedBuyerType === "WHOLESALER_A" ? PartyType.WHOLESALER : PartyType.RETAILER,
            },
          });
        }
        updateData.partyId = party.id;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: { party: true },
    });

    return NextResponse.json({
      success: true,
      user: MobileAuthService.sanitizeUser(updatedUser),
      party: updatedUser.party,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update profile" }, { status: 400 });
  }
}

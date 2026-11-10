import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getMobileAuthUser(req);
  const buyerType = user?.buyerApproved ? user.buyerType : "CUSTOMER";
  const buyerApproved = Boolean(user?.buyerApproved);

  const identifier = params.id;

  // Find product by ID or shortCode
  let product = await storeService.getProductDetail(identifier, {
    buyerType,
    buyerApproved,
  });

  if (!product) {
    const byCode = await prisma.product.findFirst({
      where: { shortCode: identifier },
      select: { id: true },
    });
    if (byCode) {
      product = await storeService.getProductDetail(byCode.id, {
        buyerType,
        buyerApproved,
      });
    }
  }

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const related = await storeService.getRelatedProducts(
    product.id,
    product.categoryId || null,
    buyerType
  ).catch(() => []);

  // Compute tier discounts / thresholds
  const packSize = product.packSize || 1;
  const packLabel = product.packLabel || "Carton";
  const unitPrice = product.unitPricePaise ?? product.mrpPaise ?? 0;

  const rawProduct = await prisma.product.findUnique({
    where: { id: product.id },
    select: {
      priceCPaise: true,
      priceBPaise: true,
      priceAPaise: true,
    },
  });

  const tierPricing = {
    retailPricePaise: unitPrice,
    mrpPaise: product.mrpPaise || unitPrice,
    tierCPaise: rawProduct?.priceCPaise || unitPrice,
    tierBPaise: rawProduct?.priceBPaise || null,
    tierAPaise: rawProduct?.priceAPaise || null,
    packSize,
    packLabel,
    availableUnits: [
      { unit: "Pcs", multiplier: 1, label: "Single Piece" },
      ...(packSize > 1 ? [{ unit: packLabel, multiplier: packSize, label: `${packLabel} (${packSize} pcs)` }] : []),
    ],
    wholesaleNudge: rawProduct?.priceBPaise && rawProduct.priceBPaise < unitPrice
      ? `Save ₹${((unitPrice - rawProduct.priceBPaise) / 100).toFixed(0)}/pc when buying wholesale!`
      : null,
  };

  return NextResponse.json({
    product,
    tierPricing,
    relatedProducts: related,
  }, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
    },
  });
}

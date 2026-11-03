import { NextRequest, NextResponse } from "next/server";
import { MobileSavedListService } from "@/modules/mobile/mobile-saved-list.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const listId = params.id;
    const result = await MobileSavedListService.addAllToCart(user.id, listId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to add items to cart" }, { status: 400 });
  }
}

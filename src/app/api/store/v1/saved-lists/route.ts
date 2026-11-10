import { NextRequest, NextResponse } from "next/server";
import { MobileSavedListService } from "@/modules/mobile/mobile-saved-list.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lists = await MobileSavedListService.getUserLists(user.id);
    return NextResponse.json({ lists });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch lists" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { name, items = [] } = body;

    const newList = await MobileSavedListService.createList(user.id, name, items);
    return NextResponse.json({
      success: true,
      list: newList,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create list" }, { status: 400 });
  }
}

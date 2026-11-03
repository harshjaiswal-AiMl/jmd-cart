import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import { MobileAccountService } from "@/modules/mobile/mobile-account.service";

export async function POST(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await MobileAccountService.deleteAccount(user.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete account" }, { status: 500 });
  }
}

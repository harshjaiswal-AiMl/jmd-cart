import { NextRequest, NextResponse } from "next/server";
import { MobileAuthService } from "@/modules/mobile/mobile-auth.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone, appHash } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const result = await MobileAuthService.sendOtp(phone, appHash);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to send OTP" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { MobileAuthService } from "@/modules/mobile/mobile-auth.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { refreshToken, deviceId } = body;

    if (!refreshToken || !deviceId) {
      return NextResponse.json({ error: "refreshToken and deviceId are required" }, { status: 400 });
    }

    const rotated = await MobileAuthService.rotateRefreshToken(refreshToken, deviceId);
    if (!rotated) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      user: rotated.user,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to refresh token" }, { status: 400 });
  }
}

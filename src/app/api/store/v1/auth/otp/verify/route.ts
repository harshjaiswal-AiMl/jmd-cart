import { NextRequest, NextResponse } from "next/server";
import { MobileAuthService } from "@/modules/mobile/mobile-auth.service";
import { MobileDeviceService } from "@/modules/mobile/mobile-device.service";
import { cartService } from "@/modules/cart/cart.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone, otp, deviceId, platform = "android", fcmToken, appVersion, guestCartItems } = body;

    if (!phone || !otp) {
      return NextResponse.json({ error: "Phone number and OTP are required" }, { status: 400 });
    }

    const effectiveDeviceId = deviceId || `dev_${phone.replace(/\D/g, "").slice(-10)}`;

    const authResult = await MobileAuthService.verifyOtp(phone, otp, effectiveDeviceId);

    // Register / update device
    await MobileDeviceService.registerDevice({
      deviceId: effectiveDeviceId,
      platform,
      fcmToken,
      appVersion,
      userId: authResult.user.id,
    });

    // Merge guest cart items if provided
    if (Array.isArray(guestCartItems) && guestCartItems.length > 0) {
      for (const item of guestCartItems) {
        if (item.productId && item.quantity > 0) {
          try {
            await cartService.addToCart(authResult.user.id, item.productId, item.quantity);
          } catch (e) {
            console.warn("[AuthVerify] Could not merge cart item:", e);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      user: authResult.user,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid OTP" }, { status: 400 });
  }
}

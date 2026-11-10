import { NextRequest, NextResponse } from "next/server";
import { addressService } from "@/modules/address/address.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const addresses = await addressService.getUserAddresses(user.id);
    return NextResponse.json({ addresses });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch addresses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const newAddress = await addressService.saveAddress(user.id, body);
    return NextResponse.json({
      success: true,
      address: newAddress,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save address" }, { status: 400 });
  }
}

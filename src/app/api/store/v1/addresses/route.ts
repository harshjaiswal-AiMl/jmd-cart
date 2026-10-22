import { NextRequest } from "next/server";
import { addressService } from "@/modules/address";
import { userAddressSchema } from "@/modules/address/address.types";
import { apiSuccess, apiError } from "@/lib/api-response";
import { auth } from "@/auth";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiSuccess([]);
    }

    const addresses = await addressService.getUserAddresses(session.user.id);
    return apiSuccess(addresses);
  } catch (err: any) {
    return apiError(err.message || "Failed to fetch addresses", 500, "SERVER_ERROR");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Please log in to manage addresses", 401, "UNAUTHORIZED");
    }

    const body = await req.json();
    const parsed = userAddressSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid address data", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    const saved = await addressService.saveAddress(session.user.id, parsed.data);
    return apiSuccess(saved);
  } catch (err: any) {
    return apiError(err.message || "Failed to save address", 500, "SERVER_ERROR");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Please log in to manage addresses", 401, "UNAUTHORIZED");
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return apiError("Address ID is required", 400, "MISSING_ID");
    }

    await addressService.deleteAddress(session.user.id, id);
    return apiSuccess({ deleted: true });
  } catch (err: any) {
    return apiError(err.message || "Failed to delete address", 500, "SERVER_ERROR");
  }
}

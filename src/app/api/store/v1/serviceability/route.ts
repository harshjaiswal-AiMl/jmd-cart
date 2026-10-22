import { NextRequest } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const pincode = url.searchParams.get("pincode");

    if (!pincode) {
      return apiError("Pincode is required", 400, "MISSING_PINCODE");
    }

    const result = await storeService.checkServiceability(pincode);
    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message || "Failed to check serviceability", 500, "SERVER_ERROR");
  }
}

import { NextRequest } from "next/server";
import { orderService } from "@/modules/order/order.service";
import { createOrderInputSchema } from "@/modules/order/order.types";
import { apiSuccess, apiError } from "@/lib/api-response";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return apiError(
        "Please log in or create an account to complete your order",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const body = await req.json();
    const parsed = createOrderInputSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const order = await orderService.createOrderFromCart(userId, parsed.data, ip);

    return apiSuccess(order);
  } catch (err: any) {
    return apiError(err.message || "Checkout failed", 400, "CHECKOUT_FAILED");
  }
}

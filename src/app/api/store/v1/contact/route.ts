import { NextRequest } from "next/server";
import { z } from "zod";
import { storeService } from "@/modules/store/store.service";
import { apiSuccess, apiError } from "@/lib/api-response";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid 10-digit phone number is required").max(15),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  subject: z.string().optional(),
  message: z.string().min(5, "Message must be at least 5 characters"),
  type: z.enum(["contact", "wholesale_enquiry"]).default("contact"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", 400, "VALIDATION_ERROR", parsed.error.format());
    }

    const message = await storeService.createContactMessage(parsed.data);

    return apiSuccess({
      id: message.id,
      message:
        parsed.data.type === "wholesale_enquiry"
          ? "Thank you for your wholesale enquiry. Our business distribution team will contact you within 24 hours."
          : "Thank you for contacting JMD Cart. We will get back to you shortly.",
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to submit contact enquiry", 500, "SERVER_ERROR");
  }
}

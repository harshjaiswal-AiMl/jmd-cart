import { NextResponse } from "next/server";
import { settingsService } from "@/modules/settings/settings.service";

export async function GET() {
  let businessDetails = {
    name: "JMD Cart",
    phone: "+91 92110 40269",
    whatsapp: "+91 92110 40269",
    supportEmail: "support@jmdcart.com",
    address: "Patna, Bihar, India",
  };

  try {
    const details = await settingsService.getBusinessDetails();
    if (details) {
      businessDetails = {
        name: details.legalName || details.tradeName || "JMD Cart",
        phone: details.phone || "+91 92110 40269",
        whatsapp: details.phone || "+91 92110 40269",
        supportEmail: details.email || "support@jmdcart.com",
        address: details.address || "Patna, Bihar, India",
      };
    }
  } catch {
    // Use defaults
  }

  const appConfig = {
    appName: "JMD Cart",
    version: {
      latestVersion: "1.0.0",
      minSupportedVersion: "1.0.0",
      forceUpdate: false,
      updateUrl: "https://play.google.com/store/apps/details?id=com.jmdcart.shop",
    },
    maintenance: {
      enabled: false,
      title: "Routine Maintenance",
      message: "We are currently upgrading JMD Cart to serve you better. We'll be back shortly!",
    },
    support: {
      phone: businessDetails.phone,
      whatsapp: businessDetails.whatsapp,
      email: businessDetails.supportEmail,
      callHelpline: "tel:" + businessDetails.phone.replace(/\s+/g, ""),
      whatsappChat: `https://wa.me/${businessDetails.whatsapp.replace(/\D/g, "")}?text=Hi%20JMD%20Cart%20Support`,
    },
    store: {
      currency: "INR",
      currencySymbol: "₹",
      defaultLanguage: "en",
      availableLanguages: [
        { code: "en", label: "English", nativeLabel: "English" },
        { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
      ],
      deliveryArea: "Serving selected pin codes in Patna & surrounding areas. Free delivery above ₹499.",
      deliverySlots: [
        { id: "morning", label: "Morning (8:00 AM - 12:00 PM)", active: true },
        { id: "afternoon", label: "Afternoon (12:00 PM - 4:00 PM)", active: true },
        { id: "evening", label: "Evening (4:00 PM - 8:00 PM)", active: true },
      ],
    },
    featureFlags: {
      savedLists: true,
      notifyMe: true,
      buyAgain: true,
      hindiLanguage: true,
      deliverySlots: true,
      tierPriceHints: true,
    },
  };

  return NextResponse.json(appConfig, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}

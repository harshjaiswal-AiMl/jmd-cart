import { auth } from "@/auth";
import { cartService } from "@/modules/cart/cart.service";
import { wishlistService } from "@/modules/wishlist";
import { storeService } from "@/modules/store/store.service";
import { StoreHeader } from "./StoreHeader";
import { StoreFooter } from "./StoreFooter";
import { FloatingCartBar } from "./FloatingCartBar";
import { MobileBottomNav } from "./MobileBottomNav";

interface StoreShellProps {
  children: React.ReactNode;
  activeCategory?: string;
  hideTrustStrip?: boolean;
}

export async function StoreShell({
  children,
  activeCategory,
  hideTrustStrip = false,
}: StoreShellProps) {
  const session = await auth();
  const userId = session?.user?.id;

  const [categories, settings, cartSummary, wishlistCount] = await Promise.all([
    storeService.getCategories({ featured: true }).catch(() => []),
    storeService.getStorefrontSettings().catch(() => ({
      storeName: "JMD Cart",
      tagline: "Saharsa Grocery & Wholesale",
      phone: "+91 6278 223400",
      whatsappNumber: "916278223400",
      address: "Station Road, Purab Bazar, Saharsa, Bihar 852201",
      operatingHours: "7:00 AM – 9:00 PM (Everyday)",
      gstin: "10AABCC1234D1Z2",
      fssai: "10422000000123",
      announcementText: "⚡ Free Delivery in Saharsa town above ₹2,000 | 100% Genuine Wholesale Billing",
      freeDeliveryThresholdPaise: 200000,
      standardDeliveryChargePaise: 5000,
      serviceablePincodes: ["852201", "852202", "852106", "852127"],
    })),
    userId ? cartService.getCartSummary(userId).catch(() => null) : null,
    userId ? wishlistService.getWishlistCount(userId).catch(() => 0) : 0,
  ]);

  const cartCount = cartSummary?.totalPieces || 0;
  const cartTotalRupees = cartSummary ? cartSummary.totalPaise / 100 : 0;
  const savingsRupees = cartSummary
    ? Math.max(0, (cartSummary.subtotalPaise - cartSummary.totalPaise) / 100)
    : 0;

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between selection:bg-primary-container selection:text-on-primary">
      {/* Global Stitch Header */}
      <StoreHeader
        cartCount={cartCount}
        cartTotalRupees={cartTotalRupees}
        activeCategory={activeCategory}
        categories={categories}
        userName={session?.user?.name || ""}
        isLoggedIn={!!userId}
        announcementText={settings.announcementText}
        phone={settings.phone}
      />

      {/* Main Content with top padding for fixed header and bottom padding for mobile bar */}
      <main className="w-full pt-32 md:pt-36 pb-20 sm:pb-8 flex-1">
        {children}
      </main>

      {/* Global Stitch Footer */}
      <StoreFooter
        phone={settings.phone}
        whatsapp={settings.whatsappNumber}
        address={settings.address}
        gstin={settings.gstin}
        fssai={settings.fssai}
        operatingHours={settings.operatingHours}
      />

      {/* Floating Bottom Cart Bar */}
      <FloatingCartBar
        totalPieces={cartCount}
        totalRupees={cartTotalRupees}
        savingsRupees={savingsRupees}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        cartCount={cartCount}
        wishlistCount={wishlistCount}
      />
    </div>
  );
}

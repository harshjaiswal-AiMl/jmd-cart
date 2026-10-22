import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "My Account | JMD Cart Saharsa",
  description: "Manage your profile, delivery addresses, GST details, and order history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      orders: { take: 3, orderBy: { createdAt: "desc" } },
      party: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <StoreShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "My Account" },
          ]}
        />

        {/* Profile Card */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary text-on-primary font-serif font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md">
              {(user.name || user.phone || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-serif text-on-surface">
                  {user.name || "Customer"}
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-fixed/20 text-primary">
                  {user.role}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-mono">
                +91 {user.phone || "No phone linked"} {user.email ? `• ${user.email}` : ""}
              </p>
              {user.party?.type && (
                <div className="mt-2 text-xs font-bold text-tertiary">
                  Party Type: {user.party.type} ({user.party.name})
                </div>
              )}
            </div>
          </div>

          <Link
            href="/logout"
            className="px-4 py-2 rounded-xl bg-error-container/20 text-error hover:bg-error-container/40 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign Out
          </Link>
        </div>

        {/* 3 Quick Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/orders"
            className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm hover:border-primary/40 transition-colors flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <div className="font-bold text-sm text-on-surface">Order History</div>
              <div className="text-xs text-on-surface-variant">View invoices &amp; tracking</div>
            </div>
          </Link>

          <Link
            href="/wishlist"
            className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm hover:border-primary/40 transition-colors flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">favorite</span>
            </div>
            <div>
              <div className="font-bold text-sm text-on-surface">Saved Items</div>
              <div className="text-xs text-on-surface-variant">Manage your wishlist</div>
            </div>
          </Link>

          <Link
            href="/wholesale"
            className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm hover:border-primary/40 transition-colors flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <div>
              <div className="font-bold text-sm text-on-surface">Wholesale Hub</div>
              <div className="text-xs text-on-surface-variant">Bulk mandi slab rates</div>
            </div>
          </Link>
        </div>

        {/* Saved Addresses Section */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
            <h2 className="text-lg font-bold font-serif text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">home_pin</span>
              Saved Delivery Addresses
            </h2>
          </div>

          {user.addresses.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant text-sm">
              <p>No saved addresses yet. Addresses are automatically saved during checkout.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-on-surface">{addr.name}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold bg-tertiary-fixed/30 text-tertiary px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-on-surface-variant leading-relaxed">
                    {addr.addressLine}
                    {addr.area ? `, ${addr.area}` : ""}, {addr.city} - {addr.pincode}
                  </div>
                  <div className="text-xs font-mono text-on-surface-variant">
                    Phone: +91 {addr.phone}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </StoreShell>
  );
}

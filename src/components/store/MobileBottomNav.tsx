"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileBottomNavProps {
  cartCount?: number;
  wishlistCount?: number;
}

export function MobileBottomNav({
  cartCount = 0,
  wishlistCount = 0,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/", icon: "home" },
    { label: "Categories", href: "/categories", icon: "grid_view" },
    { label: "Wholesale", href: "/wholesale", icon: "storefront" },
    { label: "Wishlist", href: "/wishlist", icon: "favorite", badge: wishlistCount },
    { label: "Cart", href: "/cart", icon: "shopping_bag", badge: cartCount },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container-high/80 sm:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-area-bottom"
    >
      <div className="grid grid-cols-5 h-14 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                isActive ? "text-primary font-bold" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-secondary-container text-on-secondary-container text-[10px] font-bold px-1 py-0.2 rounded-full min-w-[16px] text-center">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight font-medium tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

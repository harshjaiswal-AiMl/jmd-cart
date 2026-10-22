import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const nonHomeItems = items.filter(
    (item) => item.href !== "/" && item.label.toLowerCase() !== "home"
  );
  const allItems = [{ label: "Home", href: "/" }, ...nonHomeItems];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: allItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.href ? `https://jmdcart.com${item.href}` : undefined,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="py-2.5">
        <ol className="flex items-center flex-wrap gap-1.5 text-xs text-on-surface-variant font-medium">
          <li>
            <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">home</span>
              <span>Home</span>
            </Link>
          </li>
          {nonHomeItems.map((item, idx) => {
            const isLast = idx === nonHomeItems.length - 1;
            return (
              <li key={idx} className="flex items-center gap-1.5">
                <span className="text-outline/60 text-[10px]">/</span>
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-on-surface font-semibold truncate max-w-[200px] sm:max-w-none">
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

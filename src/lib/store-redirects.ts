/**
 * Storefront 301 Redirect Resolver
 * Maps legacy /store/* URLs to clean canonical URLs
 */

export interface RedirectTarget {
  destination: string;
  permanent: boolean;
}

export function resolveStorefrontRedirect(
  pathname: string,
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>
): RedirectTarget | null {
  if (!pathname.startsWith("/store")) {
    return null;
  }

  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(
          Object.entries(searchParams || {}).flatMap(([k, v]) => {
            if (Array.isArray(v)) return v.map((item) => [k, item]);
            return v !== undefined ? [[k, v]] : [];
          })
        );

  // Exact /store
  if (pathname === "/store" || pathname === "/store/") {
    const category = params.get("category");
    const company = params.get("company");
    const q = params.get("q");

    if (q) {
      params.delete("q");
      const qs = params.toString();
      return {
        destination: `/search?q=${encodeURIComponent(q)}${qs ? `&${qs}` : ""}`,
        permanent: true,
      };
    }

    if (category) {
      params.delete("category");
      const qs = params.toString();
      return {
        destination: `/category/${encodeURIComponent(category)}${qs ? `?${qs}` : ""}`,
        permanent: true,
      };
    }

    if (company) {
      params.delete("company");
      const qs = params.toString();
      return {
        destination: `/brand/${encodeURIComponent(company)}${qs ? `?${qs}` : ""}`,
        permanent: true,
      };
    }

    const qs = params.toString();
    return {
      destination: `/${qs ? `?${qs}` : ""}`,
      permanent: true,
    };
  }

  // /store/products/[id]
  const productMatch = pathname.match(/^\/store\/products\/([^/]+)/);
  if (productMatch) {
    const id = productMatch[1];
    const qs = params.toString();
    return {
      destination: `/product/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`,
      permanent: true,
    };
  }

  // Exact route mappings
  const exactMappings: Record<string, string> = {
    "/store/wholesale": "/wholesale",
    "/store/cart": "/cart",
    "/store/checkout": "/checkout",
    "/store/orders": "/orders",
    "/store/account": "/account",
    "/store/wishlist": "/wishlist",
  };

  for (const [prefix, dest] of Object.entries(exactMappings)) {
    if (pathname === prefix || pathname === `${prefix}/`) {
      const qs = params.toString();
      return {
        destination: `${dest}${qs ? `?${qs}` : ""}`,
        permanent: true,
      };
    }
  }

  // Subpath /store/orders/[id]
  const orderMatch = pathname.match(/^\/store\/orders\/([^/]+)/);
  if (orderMatch) {
    const id = orderMatch[1];
    const qs = params.toString();
    return {
      destination: `/orders/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`,
      permanent: true,
    };
  }

  // Catch-all: strip /store prefix
  const stripped = pathname.replace(/^\/store/, "");
  const target = stripped.startsWith("/") ? stripped : `/${stripped}`;
  const qs = params.toString();
  return {
    destination: `${target || "/"}${qs ? `?${qs}` : ""}`,
    permanent: true,
  };
}

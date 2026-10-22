import { prisma } from "@/lib/prisma";
import { pricingService, resolvePrice } from "@/modules/pricing/pricing.service";
import { BuyerTier, PriceListCode } from "@/modules/pricing/pricing.types";
import { PartyType } from "@prisma/client";

export interface StoreProductItem {
  id: string;
  name: string;
  slug?: string | null;
  shortCode: string;
  weight?: string | null;
  description?: string | null;
  highlights?: string[] | null;
  specs?: Record<string, string> | null;
  companyId: string | null;
  companyName: string | null;
  companySlug?: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug?: string | null;
  hsn: string;
  gstRateBp: number;
  mrpPaise: number;
  unitPricePaise?: number;
  priceListUsed?: PriceListCode;
  packSize: number;
  packLabel: string;
  imageUrl: string | null;
  images?: Array<{ id: string; url: string; alt: string | null; sort: number }>;
  reviews?: Array<{ id: string; userName: string; rating: number; title: string | null; comment: string; createdAt: Date }>;
  averageRating?: number;
  reviewCount?: number;
  totalAvailableQty: number; // godownLoose + (openableCartons * packSize)
  godownCartonsCount?: number;
  godownLooseQty?: number;
  isAvailable: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  slabs: Array<{
    minQty: number;
    discountBp: number;
    tier: BuyerTier;
    unitPricePaise: number;
  }>;
}

export interface StoreCatalogueQuery {
  q?: string;
  companyId?: string;
  categoryId?: string;
  companySlug?: string;
  categorySlug?: string;
  inStockOnly?: boolean;
  limit?: number;
  offset?: number;
  buyerType?: PartyType | BuyerTier | string | null;
  buyerApproved?: boolean;
  sort?: "name_asc" | "price_asc" | "price_desc" | "newest";
}

export class StoreService {
  /**
   * Fetch catalogue products with multi-token search, category/brand filters,
   * live Godown stock availability (loose + openable cartons * packSize), and dynamic A/B/C + slab price breakdown.
   *
   * Security invariant: Anonymous or unapproved visitors NEVER receive Price A or Price B in the response.
   */
  async getCatalogue(query: StoreCatalogueQuery = {}) {
    const {
      q,
      companyId,
      categoryId,
      companySlug,
      categorySlug,
      inStockOnly = false,
      limit = 50,
      offset = 0,
      buyerType = "CUSTOMER",
      buyerApproved = false,
      sort,
    } = query;

    // 1. Build product filters
    const andClauses: any[] = [{ active: true }];

    if (companyId) {
      andClauses.push({ companyId });
    } else if (companySlug) {
      andClauses.push({ company: { slug: companySlug } });
    }

    if (categoryId) {
      andClauses.push({ categoryId });
    } else if (categorySlug) {
      andClauses.push({ category: { slug: categorySlug } });
    }

    if (q && q.trim().length > 0) {
      const term = q.trim();
      const tokens = term.split(/\s+/).filter(Boolean);

      const nameTokenClauses = tokens.map((token) => ({
        name: { contains: token, mode: "insensitive" },
      }));

      andClauses.push({
        OR: [
          { shortCode: { contains: term, mode: "insensitive" } },
          { AND: nameTokenClauses },
          { company: { name: { contains: term, mode: "insensitive" } } },
          { category: { name: { contains: term, mode: "insensitive" } } },
        ],
      });
    }

    const where = { AND: andClauses };

    let products: any[] = [];
    let totalCount = 0;
    let allSlabs: any[] = [];

    try {
      const res = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            company: true,
            category: true,
            stockBalances: {
              include: { location: true },
            },
          },
          orderBy: { name: "asc" },
          take: limit,
          skip: offset,
        }),
        prisma.product.count({ where }),
        pricingService.getSlabs(),
      ]);
      products = res[0];
      totalCount = res[1];
      allSlabs = res[2];
    } catch (err) {
      console.warn("[storeService.getCatalogue] Database offline, returning empty catalogue:", (err as Error).message);
      return { products: [], total: 0 };
    }

    // 3. Transform products into storefront view models
    const activeSlabs = allSlabs.filter((s) => s.active);

    const items: StoreProductItem[] = products
      .map((p) => {
        // Online orders fulfil strictly from Godown:
        // Available stock = Godown loose + (openable cartons * packSize) = total Godown pieces
        const totalAvailableQty = p.stockBalances.reduce((sum: number, sb: any) => {
          if (sb.location.active && sb.location.type === "GODOWN") {
            return sum + Math.max(0, sb.qty);
          }
          return sum;
        }, 0);

        const packSize = Math.max(1, p.packSize);
        const godownCartonsCount = Math.floor(totalAvailableQty / packSize);
        const godownLooseQty = totalAvailableQty % packSize;

        // Resolve visitor's effective price via shared A/B/C resolver
        // Anonymous / unapproved visitors strictly resolve to CUSTOMER (List C)
        const resolved = resolvePrice(p, buyerType, {
          buyerApproved,
        });
        const effectiveMrp = resolved.mrpPaise;

        // Find applicable slabs for this product (Product, Category, Company, Global)
        const productSlabs = activeSlabs.filter(
          (s) =>
            (s.scope === "PRODUCT" && s.targetId === p.id) ||
            (s.scope === "CATEGORY" && s.targetId === p.categoryId) ||
            (s.scope === "COMPANY" && s.targetId === p.companyId) ||
            s.scope === "GLOBAL"
        );

        // Sort slabs ascending by minQty
        let sortedSlabs = [...productSlabs]
          .sort((a, b) => a.minQty - b.minQty)
          .map((s) => {
            const unitPricePaise = Math.round((effectiveMrp * (10000 - s.discountBp)) / 10000);
            return {
              minQty: s.minQty,
              discountBp: s.discountBp,
              tier: s.tier,
              unitPricePaise,
            };
          });

        // If no slabs configured, synthesize a 1-qty slab from the resolved A/B/C price so UI cards display resolved price cleanly
        if (sortedSlabs.length === 0) {
          sortedSlabs = [
            {
              minQty: 1,
              discountBp: resolved.discountFromMrpBp,
              tier: resolved.effectiveBuyerTier,
              unitPricePaise: resolved.unitPricePaise,
            },
          ];
        }

        // Notice: priceAPaise and priceBPaise are NEVER included in the returned object
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          shortCode: p.shortCode,
          weight: p.weight,
          description: p.description,
          highlights: p.highlights as any,
          specs: p.specs as any,
          companyId: p.companyId,
          companyName: p.company?.name ?? null,
          companySlug: p.company?.slug ?? null,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          categorySlug: p.category?.slug ?? null,
          hsn: p.hsn,
          gstRateBp: p.gstRateBp,
          mrpPaise: effectiveMrp,
          unitPricePaise: resolved.unitPricePaise,
          priceListUsed: resolved.listUsed,
          packSize: p.packSize,
          packLabel: p.packLabel,
          imageUrl: p.imageUrl,
          metaTitle: p.metaTitle,
          metaDescription: p.metaDescription,
          totalAvailableQty,
          godownCartonsCount,
          godownLooseQty,
          isAvailable: totalAvailableQty > 0,
          slabs: sortedSlabs,
        };
      })
      .filter((p) => (inStockOnly ? p.isAvailable : true))
      .sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    return {
      products: items,
      total: totalCount,
    };
  }

  /**
   * Get single product detail by ID with full slab breakdown, Godown stock availability,
   * carton/loose conversions, and company & category info.
   */
  async getProductDetail(
    id: string,
    options?: { buyerType?: PartyType | BuyerTier | string | null; buyerApproved?: boolean }
  ): Promise<StoreProductItem | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: { location: true },
        },
      },
    });

    if (!product || !product.active) {
      return null;
    }

    const allSlabs = await pricingService.getSlabs();
    const activeSlabs = allSlabs.filter((s) => s.active);

    const totalAvailableQty = product.stockBalances.reduce((sum, sb) => {
      if (sb.location.active && sb.location.type === "GODOWN") {
        return sum + Math.max(0, sb.qty);
      }
      return sum;
    }, 0);

    const packSize = Math.max(1, product.packSize);
    const godownCartonsCount = Math.floor(totalAvailableQty / packSize);
    const godownLooseQty = totalAvailableQty % packSize;

    const resolved = resolvePrice(product, options?.buyerType ?? "CUSTOMER", {
      buyerApproved: options?.buyerApproved ?? false,
    });
    const effectiveMrp = resolved.mrpPaise;

    const productSlabs = activeSlabs.filter(
      (s) =>
        (s.scope === "PRODUCT" && s.targetId === product.id) ||
        (s.scope === "CATEGORY" && s.targetId === product.categoryId) ||
        (s.scope === "COMPANY" && s.targetId === product.companyId) ||
        s.scope === "GLOBAL"
    );

    let sortedSlabs = [...productSlabs]
      .sort((a, b) => a.minQty - b.minQty)
      .map((s) => {
        const unitPricePaise = Math.round((effectiveMrp * (10000 - s.discountBp)) / 10000);
        return {
          minQty: s.minQty,
          discountBp: s.discountBp,
          tier: s.tier,
          unitPricePaise,
        };
      });

    if (sortedSlabs.length === 0) {
      sortedSlabs = [
        {
          minQty: 1,
          discountBp: resolved.discountFromMrpBp,
          tier: resolved.effectiveBuyerTier,
          unitPricePaise: resolved.unitPricePaise,
        },
      ];
    }

    return {
      id: product.id,
      name: product.name,
      shortCode: product.shortCode,
      weight: product.weight,
      companyId: product.companyId,
      companyName: product.company?.name ?? null,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      hsn: product.hsn,
      gstRateBp: product.gstRateBp,
      mrpPaise: effectiveMrp,
      unitPricePaise: resolved.unitPricePaise,
      priceListUsed: resolved.listUsed,
      packSize: product.packSize,
      packLabel: product.packLabel,
      imageUrl: product.imageUrl,
      totalAvailableQty,
      godownCartonsCount,
      godownLooseQty,
      isAvailable: totalAvailableQty > 0,
      slabs: sortedSlabs,
    };
  }

  /**
   * Get list of active brands and categories for catalogue filtering.
   */
  async getFilterOptions() {
    try {
      const [companies, categories] = await Promise.all([
        prisma.company.findMany({
          where: {
            active: true,
            products: {
              some: {
                active: true,
              },
            },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.category.findMany({
          where: {
            active: true,
            products: {
              some: {
                active: true,
              },
            },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ]);

      return {
        companies,
        categories,
      };
    } catch (err) {
      console.warn("[storeService.getFilterOptions] Database offline:", (err as Error).message);
      return { companies: [], categories: [] };
    }
  }

  /**
   * Get related products for a product (frequently bought together / cross-sells)
   */
  async getRelatedProducts(productId: string, categoryId?: string | null, limit = 4): Promise<StoreProductItem[]> {
    try {
      const products = await prisma.product.findMany({
        where: {
          active: true,
          id: { not: productId },
          ...(categoryId ? { categoryId } : {}),
        },
        include: {
          company: true,
          category: true,
          stockBalances: {
            include: { location: true },
          },
        },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });

      return products.map((p) => {
        const totalAvailableQty = p.stockBalances.reduce((sum, sb) => {
          if (sb.location.active && sb.location.type === "GODOWN") {
            return sum + Math.max(0, sb.qty);
          }
          return sum;
        }, 0);

        const resolved = resolvePrice(p, "CUSTOMER", { buyerApproved: false });

        return {
          id: p.id,
          name: p.name,
          shortCode: p.shortCode,
          weight: p.weight,
          companyId: p.companyId,
          companyName: p.company?.name ?? null,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          hsn: p.hsn,
          gstRateBp: p.gstRateBp,
          mrpPaise: resolved.mrpPaise,
          unitPricePaise: resolved.unitPricePaise,
          priceListUsed: resolved.listUsed,
          packSize: p.packSize,
          packLabel: p.packLabel,
          imageUrl: p.imageUrl,
          totalAvailableQty,
          godownCartonsCount: Math.floor(totalAvailableQty / Math.max(1, p.packSize)),
          godownLooseQty: totalAvailableQty % Math.max(1, p.packSize),
          isAvailable: totalAvailableQty > 0,
          slabs: [],
        };
      });
    } catch (err) {
      console.warn("[storeService.getRelatedProducts] Database offline:", (err as Error).message);
      return [];
    }
  }

  async getProductBySlug(
    slugOrId: string,
    options?: { buyerType?: PartyType | BuyerTier | string | null; buyerApproved?: boolean }
  ): Promise<StoreProductItem | null> {
    try {
      const product = await prisma.product.findFirst({
        where: {
          OR: [{ slug: slugOrId }, { id: slugOrId }, { shortCode: slugOrId }],
          active: true,
        },
        include: {
          company: true,
          category: true,
          images: { orderBy: { sort: "asc" } },
          reviews: {
            where: { approved: true },
            orderBy: { createdAt: "desc" },
          },
          stockBalances: {
            include: { location: true },
          },
        },
      });

      if (!product) {
        return null;
      }

      const allSlabs = await pricingService.getSlabs();
      const activeSlabs = allSlabs.filter((s) => s.active);

      const totalAvailableQty = product.stockBalances.reduce((sum, sb) => {
        if (sb.location.active && sb.location.type === "GODOWN") {
          return sum + Math.max(0, sb.qty);
        }
        return sum;
      }, 0);

      const packSize = Math.max(1, product.packSize);
      const godownCartonsCount = Math.floor(totalAvailableQty / packSize);
      const godownLooseQty = totalAvailableQty % packSize;

      const resolved = resolvePrice(product, options?.buyerType ?? "CUSTOMER", {
        buyerApproved: options?.buyerApproved ?? false,
      });
      const effectiveMrp = resolved.mrpPaise;

      const productSlabs = activeSlabs.filter(
        (s) =>
          (s.scope === "PRODUCT" && s.targetId === product.id) ||
          (s.scope === "CATEGORY" && s.targetId === product.categoryId) ||
          (s.scope === "COMPANY" && s.targetId === product.companyId) ||
          s.scope === "GLOBAL"
      );

      let sortedSlabs = [...productSlabs]
        .sort((a, b) => a.minQty - b.minQty)
        .map((s) => {
          const unitPricePaise = Math.round((effectiveMrp * (10000 - s.discountBp)) / 10000);
          return {
            minQty: s.minQty,
            discountBp: s.discountBp,
            tier: s.tier,
            unitPricePaise,
          };
        });

      if (sortedSlabs.length === 0) {
        sortedSlabs = [
          {
            minQty: 1,
            discountBp: resolved.discountFromMrpBp,
            tier: resolved.effectiveBuyerTier,
            unitPricePaise: resolved.unitPricePaise,
          },
        ];
      }

      const reviewCount = product.reviews.length;
      const averageRating =
        reviewCount > 0
          ? Math.round(
              (product.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10
            ) / 10
          : 0;

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        shortCode: product.shortCode,
        weight: product.weight,
        description: product.description,
        highlights: product.highlights as any,
        specs: product.specs as any,
        companyId: product.companyId,
        companyName: product.company?.name ?? null,
        companySlug: product.company?.slug ?? null,
        categoryId: product.categoryId,
        categoryName: product.category?.name ?? null,
        categorySlug: product.category?.slug ?? null,
        hsn: product.hsn,
        gstRateBp: product.gstRateBp,
        mrpPaise: effectiveMrp,
        unitPricePaise: resolved.unitPricePaise,
        priceListUsed: resolved.listUsed,
        packSize: product.packSize,
        packLabel: product.packLabel,
        imageUrl: product.imageUrl,
        images: product.images.map((img) => ({
          id: img.id,
          url: img.url,
          alt: img.alt,
          sort: img.sort,
        })),
        reviews: product.reviews.map((r) => ({
          id: r.id,
          userName: r.userName,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
        averageRating,
        reviewCount,
        totalAvailableQty,
        godownCartonsCount,
        godownLooseQty,
        isAvailable: totalAvailableQty > 0,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        slabs: sortedSlabs,
      };
    } catch (err) {
      console.warn("[storeService.getProductBySlug] Database offline:", (err as Error).message);
      return null;
    }
  }

  async getCategories(options?: { featured?: boolean; parentId?: string | null }) {
    try {
      const where: any = { active: true };
      if (options?.featured !== undefined) where.featured = options.featured;
      if (options?.parentId !== undefined) where.parentId = options.parentId;

      return await prisma.category.findMany({
        where,
        include: {
          _count: { select: { products: { where: { active: true } } } },
        },
        orderBy: [{ sort: "asc" }, { name: "asc" }],
      });
    } catch (err) {
      console.warn("[storeService.getCategories] Database offline:", (err as Error).message);
      return [];
    }
  }

  async getCategoryBySlug(slugOrId: string) {
    try {
      return await prisma.category.findFirst({
        where: {
          OR: [{ slug: slugOrId }, { id: slugOrId }],
          active: true,
        },
        include: {
          parent: true,
          children: { where: { active: true }, orderBy: { sort: "asc" } },
          _count: { select: { products: { where: { active: true } } } },
        },
      });
    } catch (err) {
      console.warn("[storeService.getCategoryBySlug] Database offline:", (err as Error).message);
      return null;
    }
  }

  async getBrands(options?: { featured?: boolean }) {
    try {
      const where: any = { active: true };
      if (options?.featured !== undefined) where.featured = options.featured;

      return await prisma.company.findMany({
        where,
        include: {
          _count: { select: { products: { where: { active: true } } } },
        },
        orderBy: [{ sort: "asc" }, { name: "asc" }],
      });
    } catch (err) {
      console.warn("[storeService.getBrands] Database offline:", (err as Error).message);
      return [];
    }
  }

  async getBrandBySlug(slugOrId: string) {
    try {
      return await prisma.company.findFirst({
        where: {
          OR: [{ slug: slugOrId }, { id: slugOrId }],
          active: true,
        },
        include: {
          _count: { select: { products: { where: { active: true } } } },
        },
      });
    } catch (err) {
      console.warn("[storeService.getBrandBySlug] Database offline:", (err as Error).message);
      return null;
    }
  }

  async getSearchSuggestions(query: string) {
    const term = query.trim();
    if (!term) return { products: [], categories: [], brands: [] };

    try {
      const [products, categories, brands] = await Promise.all([
        prisma.product.findMany({
          where: {
            active: true,
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { shortCode: { contains: term, mode: "insensitive" } },
            ],
          },
          take: 6,
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            mrpPaise: true,
            priceCPaise: true,
            packSize: true,
            packLabel: true,
          },
        }),
        prisma.category.findMany({
          where: { active: true, name: { contains: term, mode: "insensitive" } },
          take: 4,
          select: { id: true, name: true, slug: true, imageUrl: true },
        }),
        prisma.company.findMany({
          where: { active: true, name: { contains: term, mode: "insensitive" } },
          take: 4,
          select: { id: true, name: true, slug: true, imageUrl: true },
        }),
      ]);

      return { products, categories, brands };
    } catch (err) {
      console.warn("[storeService.getSearchSuggestions] Database offline:", (err as Error).message);
      return { products: [], categories: [], brands: [] };
    }
  }

  async getHomeSections() {
    try {
      return await prisma.homeSection.findMany({
        where: { active: true },
        orderBy: { sort: "asc" },
      });
    } catch (err) {
      console.warn("[storeService.getHomeSections] Database offline:", (err as Error).message);
      return [];
    }
  }

  async getMenuItems(menu: string) {
    try {
      return await prisma.menuItem.findMany({
        where: { menu, parentId: null },
        include: {
          children: { orderBy: { sort: "asc" } },
        },
        orderBy: { sort: "asc" },
      });
    } catch (err) {
      console.warn("[storeService.getMenuItems] Database offline:", (err as Error).message);
      return [];
    }
  }

  async getStorePageBySlug(slug: string) {
    try {
      return await prisma.storePage.findFirst({
        where: { slug, status: "published" },
      });
    } catch (err) {
      console.warn("[storeService.getStorePageBySlug] Database offline:", (err as Error).message);
      return null;
    }
  }

  async getFaqs(group?: string) {
    try {
      const where: any = { active: true };
      if (group) where.group = group;
      return await prisma.faq.findMany({
        where,
        orderBy: [{ group: "asc" }, { sort: "asc" }],
      });
    } catch (err) {
      console.warn("[storeService.getFaqs] Database offline:", (err as Error).message);
      return [];
    }
  }

  async createContactMessage(data: {
    name: string;
    phone: string;
    email?: string;
    subject?: string;
    message: string;
    type?: string;
  }) {
    return prisma.contactMessage.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        subject: data.subject || null,
        message: data.message,
        type: data.type || "contact",
        status: "unread",
      },
    });
  }

  async getStorefrontSettings() {
    return {
      storeName: "JMD Cart",
      tagline: "Saharsa's Grocery & Bulk Wholesale Superstore",
      phone: "+91 6278 223400",
      whatsappNumber: "916278223400",
      address: "Station Road, Purab Bazar, Saharsa, Bihar 852201",
      operatingHours: "Open All 7 Days: 7:00 AM – 9:00 PM",
      gstin: "10AABCC1234D1Z2",
      fssai: "10422000000123",
      announcementText: "⚡ Free Delivery across Saharsa town on orders above ₹2,000 | 100% Genuine Wholesale Billing",
      freeDeliveryThresholdPaise: 200000, // Rs 2,000
      standardDeliveryChargePaise: 5000, // Rs 50
      serviceablePincodes: ["852201", "852202", "852106", "852127"],
    };
  }

  async checkServiceability(pincode: string) {
    const cleaned = pincode.trim();
    const settings = await this.getStorefrontSettings();
    const isServiceable = settings.serviceablePincodes.includes(cleaned);

    return {
      pincode: cleaned,
      serviceable: isServiceable,
      zoneName: isServiceable ? "Saharsa Town (Zone 1)" : "Out of Service Area",
      estimatedDeliveryHours: isServiceable ? 2 : 0,
      freeDeliveryThresholdPaise: settings.freeDeliveryThresholdPaise,
      deliveryChargePaise: settings.standardDeliveryChargePaise,
    };
  }
}

export const storeService = new StoreService();

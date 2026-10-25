import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  CreateProductInput,
  ProductSearchQuery,
  CreateCompanyInput,
  CreateCategoryInput,
  ProductWithDetails,
} from "./catalog.types";

export class CatalogRepository {
  /**
   * Search products with multi-token fuzzy/prefix search across name, shortCode, and company name.
   * Ranks in-stock products (total across active locations > 0) before out-of-stock products in the database.
   */
  async searchProducts(query: ProductSearchQuery): Promise<ProductWithDetails[]> {
    const { queryRankedProductIds } = await import("@/modules/stock/availability");
    const whereParts: Prisma.Sql[] = [];

    if (query.activeOnly !== false) {
      whereParts.push(Prisma.sql`p.active = true`);
    }
    if (query.companyId) {
      whereParts.push(Prisma.sql`p.company_id = ${query.companyId}`);
    }
    if (query.categoryId) {
      whereParts.push(Prisma.sql`p.category_id = ${query.categoryId}`);
    }
    if (query.q && query.q.trim().length > 0) {
      const pattern = `%${query.q.trim()}%`;
      whereParts.push(Prisma.sql`(
        p.short_code ILIKE ${pattern}
        OR p.name ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM companies c WHERE c.id = p.company_id AND c.name ILIKE ${pattern}
        )
      )`);
    }

    const whereSql = whereParts.length > 0 ? Prisma.join(whereParts, " AND ") : undefined;

    const { productIds } = await queryRankedProductIds("ADMIN", {
      whereSql,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });

    if (productIds.length === 0) {
      return [];
    }

    const productsRaw = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: {
            location: true,
          },
        },
      },
    });

    const map = new Map(productsRaw.map((p) => [p.id, p]));
    return productIds
      .map((id) => map.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }


  async countProducts(query: ProductSearchQuery): Promise<number> {
    const where = this.buildSearchWhere(query);
    return prisma.product.count({ where });
  }

  private buildSearchWhere(query: ProductSearchQuery): Prisma.ProductWhereInput {
    const andClauses: Prisma.ProductWhereInput[] = [];

    if (query.activeOnly !== false) {
      andClauses.push({ active: true });
    }

    if (query.companyId) {
      andClauses.push({ companyId: query.companyId });
    }

    if (query.categoryId) {
      andClauses.push({ categoryId: query.categoryId });
    }

    if (query.q && query.q.trim().length > 0) {
      const tokens = query.q.trim().split(/\s+/).filter(Boolean);

      // Match either shortCode exact/contains OR all tokens in product name / company name
      const orClauses: Prisma.ProductWhereInput[] = [
        { shortCode: { contains: query.q.trim(), mode: "insensitive" } },
      ];

      // Multi-token match on name
      const nameTokenAndClauses = tokens.map((token) => ({
        name: { contains: token, mode: "insensitive" as Prisma.QueryMode },
      }));

      orClauses.push({ AND: nameTokenAndClauses });

      andClauses.push({ OR: orClauses });
    }

    return andClauses.length > 0 ? { AND: andClauses } : {};
  }

  async findProductById(id: string): Promise<ProductWithDetails | null> {
    return prisma.product.findUnique({
      where: { id },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: {
            location: true,
          },
        },
      },
    });
  }

  async findProductByShortCode(shortCode: string): Promise<ProductWithDetails | null> {
    return prisma.product.findUnique({
      where: { shortCode },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: {
            location: true,
          },
        },
      },
    });
  }

  async createProduct(data: CreateProductInput) {
    return prisma.product.create({
      data: {
        name: data.name,
        shortCode: data.shortCode,
        weight: data.weight ?? null,
        companyId: data.companyId ?? null,
        categoryId: data.categoryId ?? null,
        hsn: data.hsn ?? "0000",
        gstRateBp: data.gstRateBp ?? 0,
        mrpPaise: data.mrpPaise ?? null,
        priceAPaise: data.priceAPaise ?? null,
        priceBPaise: data.priceBPaise ?? null,
        priceCPaise: data.priceCPaise ?? null,
        packSize: data.packSize ?? 1,
        packLabel: data.packLabel ?? "Carton",
        reorderLevel: data.reorderLevel ?? 0,
        imageUrl: data.imageUrl ?? null,
        active: data.active ?? true,
      },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: {
            location: true,
          },
        },
      },
    });
  }

  async updateProduct(id: string, data: Partial<CreateProductInput>) {
    return prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.shortCode !== undefined ? { shortCode: data.shortCode } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.hsn !== undefined ? { hsn: data.hsn } : {}),
        ...(data.gstRateBp !== undefined ? { gstRateBp: data.gstRateBp } : {}),
        ...(data.mrpPaise !== undefined ? { mrpPaise: data.mrpPaise } : {}),
        ...(data.priceAPaise !== undefined ? { priceAPaise: data.priceAPaise } : {}),
        ...(data.priceBPaise !== undefined ? { priceBPaise: data.priceBPaise } : {}),
        ...(data.priceCPaise !== undefined ? { priceCPaise: data.priceCPaise } : {}),
        ...(data.packSize !== undefined ? { packSize: data.packSize } : {}),
        ...(data.packLabel !== undefined ? { packLabel: data.packLabel } : {}),
        ...(data.reorderLevel !== undefined ? { reorderLevel: data.reorderLevel } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: {
            location: true,
          },
        },
      },
    });
  }

  // Companies
  async listCompanies(activeOnly = true) {
    return prisma.company.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async findCompanyById(id: string) {
    return prisma.company.findUnique({ where: { id } });
  }

  async findCompanyByName(name: string) {
    return prisma.company.findUnique({ where: { name } });
  }

  async createCompany(data: CreateCompanyInput) {
    return prisma.company.create({
      data: {
        name: data.name,
        active: data.active,
      },
    });
  }

  // Categories
  async listCategories(activeOnly = true) {
    return prisma.category.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async findCategoryById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  }

  async findCategoryByName(name: string) {
    return prisma.category.findUnique({ where: { name } });
  }

  async createCategory(data: CreateCategoryInput) {
    return prisma.category.create({
      data: {
        name: data.name,
        active: data.active,
      },
    });
  }
}

export const catalogRepository = new CatalogRepository();

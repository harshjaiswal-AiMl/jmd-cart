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
   */
  async searchProducts(query: ProductSearchQuery): Promise<ProductWithDetails[]> {
    const where = this.buildSearchWhere(query);

    return prisma.product.findMany({
      where,
      include: {
        company: true,
        category: true,
        stockBalances: {
          include: {
            location: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    });
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
        companyId: data.companyId ?? null,
        categoryId: data.categoryId ?? null,
        hsn: data.hsn,
        gstRateBp: data.gstRateBp,
        mrpPaise: data.mrpPaise,
        packSize: data.packSize,
        packLabel: data.packLabel,
        reorderLevel: data.reorderLevel,
        imageUrl: data.imageUrl ?? null,
        active: data.active,
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
        ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.hsn !== undefined ? { hsn: data.hsn } : {}),
        ...(data.gstRateBp !== undefined ? { gstRateBp: data.gstRateBp } : {}),
        ...(data.mrpPaise !== undefined ? { mrpPaise: data.mrpPaise } : {}),
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

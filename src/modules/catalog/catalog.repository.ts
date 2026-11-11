import { searchProducts as sharedSearchProducts } from "@/lib/search/product-search.server";
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
    const res = await sharedSearchProducts({
      q: query.q,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      activeOnly: query.activeOnly !== false,
      companyId: query.companyId,
      categoryId: query.categoryId,
      locationScope: "ADMIN",
    });
    return res.items as ProductWithDetails[];
  }

  async countProducts(query: ProductSearchQuery): Promise<number> {
    const res = await sharedSearchProducts({
      q: query.q,
      limit: 10000,
      offset: 0,
      activeOnly: query.activeOnly !== false,
      companyId: query.companyId,
      categoryId: query.categoryId,
      locationScope: "ADMIN",
    });
    return res.total;
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

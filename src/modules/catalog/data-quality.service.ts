import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";

export type DataQualityIssueType =
  | "NUMERIC_OR_SHORT_NAME"
  | "PACK_SIZE_OUTLIER"
  | "MISSING_PRICE"
  | "MISSING_BRAND_OR_CATEGORY"
  | "DUPLICATE_NAME"
  | "MISSING_IMAGE";

export interface DataQualityProductItem {
  id: string;
  name: string;
  shortCode: string;
  companyId: string | null;
  companyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
  packSize: number;
  packLabel: string;
  imageUrl: string | null;
  active: boolean;
  issues: DataQualityIssueType[];
  issueLabels: string[];
}

export interface DataQualityReportSummary {
  totalProducts: number;
  totalFlaggedProducts: number;
  activeFlaggedCount: number;
  issuesBreakdown: Record<DataQualityIssueType, number>;
  items: DataQualityProductItem[];
}

export class DataQualityService {
  async getReport(role: UserRole): Promise<DataQualityReportSummary> {
    assertPermission(role, Permission.VIEW_PRODUCTS);

    const products = await prisma.product.findMany({
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Detect duplicate names across all products (case-insensitive)
    const nameCountMap = new Map<string, number>();
    for (const p of products) {
      const norm = p.name.trim().toLowerCase();
      nameCountMap.set(norm, (nameCountMap.get(norm) ?? 0) + 1);
    }

    const issuesBreakdown: Record<DataQualityIssueType, number> = {
      NUMERIC_OR_SHORT_NAME: 0,
      PACK_SIZE_OUTLIER: 0,
      MISSING_PRICE: 0,
      MISSING_BRAND_OR_CATEGORY: 0,
      DUPLICATE_NAME: 0,
      MISSING_IMAGE: 0,
    };

    const items: DataQualityProductItem[] = [];

    for (const p of products) {
      const issues: DataQualityIssueType[] = [];
      const issueLabels: string[] = [];
      const trimmedName = p.name.trim();

      // 1. Numeric or very short name
      if (trimmedName.length < 3 || /^\d+(\.\d+)?$/.test(trimmedName)) {
        issues.push("NUMERIC_OR_SHORT_NAME");
        issueLabels.push(
          trimmedName.length < 3 ? "Very short name (< 3 chars)" : "Numeric name (Excel column mismatch)"
        );
        issuesBreakdown.NUMERIC_OR_SHORT_NAME++;
      }

      // 2. Pack size outlier (> 5000 or <= 0)
      if (p.packSize > 5000 || p.packSize <= 0) {
        issues.push("PACK_SIZE_OUTLIER");
        issueLabels.push(`Pack size outlier (${p.packSize} pcs/case)`);
        issuesBreakdown.PACK_SIZE_OUTLIER++;
      }

      // 3. Missing price on any/all lists
      const hasAnyPrice =
        (p.mrpPaise != null && p.mrpPaise > 0) ||
        (p.priceCPaise != null && p.priceCPaise > 0) ||
        (p.priceBPaise != null && p.priceBPaise > 0) ||
        (p.priceAPaise != null && p.priceAPaise > 0);

      const missingLists: string[] = [];
      if (!p.mrpPaise || p.mrpPaise <= 0) missingLists.push("MRP");
      if (!p.priceCPaise || p.priceCPaise <= 0) missingLists.push("List C");
      if (!p.priceBPaise || p.priceBPaise <= 0) missingLists.push("List B");
      if (!p.priceAPaise || p.priceAPaise <= 0) missingLists.push("List A");

      if (!hasAnyPrice || missingLists.length > 0) {
        issues.push("MISSING_PRICE");
        issueLabels.push(
          !hasAnyPrice ? "Zero price on all lists" : `Missing price: ${missingLists.join(", ")}`
        );
        issuesBreakdown.MISSING_PRICE++;
      }

      // 4. Missing brand or category
      if (!p.companyId || !p.categoryId) {
        issues.push("MISSING_BRAND_OR_CATEGORY");
        const missing = [];
        if (!p.companyId) missing.push("Brand");
        if (!p.categoryId) missing.push("Category");
        issueLabels.push(`Unassigned: ${missing.join(" & ")}`);
        issuesBreakdown.MISSING_BRAND_OR_CATEGORY++;
      }

      // 5. Duplicate name
      if ((nameCountMap.get(trimmedName.toLowerCase()) ?? 0) > 1) {
        issues.push("DUPLICATE_NAME");
        issueLabels.push("Duplicate product name");
        issuesBreakdown.DUPLICATE_NAME++;
      }

      // 6. Missing image
      if (!p.imageUrl || p.imageUrl.trim().length === 0) {
        issues.push("MISSING_IMAGE");
        issueLabels.push("No photo uploaded");
        issuesBreakdown.MISSING_IMAGE++;
      }

      items.push({
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        companyId: p.companyId,
        companyName: p.company?.name ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        mrpPaise: p.mrpPaise,
        priceAPaise: p.priceAPaise,
        priceBPaise: p.priceBPaise,
        priceCPaise: p.priceCPaise,
        packSize: p.packSize,
        packLabel: p.packLabel,
        imageUrl: p.imageUrl,
        active: p.active,
        issues,
        issueLabels,
      });
    }

    const flaggedItems = items.filter((i) => i.issues.length > 0);
    const activeFlaggedCount = flaggedItems.filter((i) => i.active).length;

    return {
      totalProducts: products.length,
      totalFlaggedProducts: flaggedItems.length,
      activeFlaggedCount,
      issuesBreakdown,
      items,
    };
  }

  async bulkDeactivateProducts(
    role: UserRole,
    actorId: string,
    productIds: string[],
    reason: string,
    ip?: string
  ): Promise<{ deactivatedCount: number }> {
    assertPermission(role, Permission.MANAGE_PRODUCTS);

    if (productIds.length === 0) {
      return { deactivatedCount: 0 };
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: productIds }, active: true },
      data: { active: false },
    });

    await auditService.log({
      actorId,
      action: "PRODUCTS_BULK_DEACTIVATED",
      entity: "Product",
      after: {
        productIds,
        deactivatedCount: result.count,
        reason,
      },
      ip,
    });

    return { deactivatedCount: result.count };
  }
}

export const dataQualityService = new DataQualityService();

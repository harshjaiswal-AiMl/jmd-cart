import {
  LocationType,
  MovementType,
  OrderStatus,
  PartyType,
  PaymentMode,
  Prisma,
  PurchaseStatus,
  UserRole,
  VanDayStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";
import { stockRepository } from "@/modules/stock/stock.repository";
import { ensureSupplierParty } from "@/modules/party/party.service";
import { CRUD_ENTITIES, CrudEntityKey } from "./crud.registry";

export interface CrudListOptions {
  search?: string;
  includeArchived?: boolean;
  filterRole?: string;
}

export interface CrudDeleteResult {
  action: "DELETED" | "ARCHIVED" | "VOIDED";
  id: string;
}

function toPaise(rupeesVal: unknown): number {
  const n = Number(rupeesVal ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function toRupees(paiseVal: number | null | undefined): number {
  if (paiseVal === null || paiseVal === undefined) return 0;
  return Number((paiseVal / 100).toFixed(2));
}

async function getJsonListSetting<T extends { id: string }>(
  key: string
): Promise<T[]> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row || !Array.isArray(row.value)) return [];
  return row.value as unknown as T[];
}

async function saveJsonListSetting<T extends { id: string }>(
  key: string,
  items: T[]
): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value: items as unknown as Prisma.InputJsonValue },
    create: { key, value: items as unknown as Prisma.InputJsonValue },
  });
}

async function getCompanyContactsMap(): Promise<
  Record<string, { gstin?: string; contactPhone?: string }>
> {
  const row = await prisma.setting.findUnique({
    where: { key: "company_contacts" },
  });
  if (!row || !row.value || typeof row.value !== "object" || Array.isArray(row.value)) {
    return {};
  }
  return row.value as Record<string, { gstin?: string; contactPhone?: string }>;
}

async function saveCompanyContact(
  companyId: string,
  companyName: string,
  gstin?: string,
  contactPhone?: string
): Promise<void> {
  const map = await getCompanyContactsMap();
  const prev =
    map[companyId] || map[companyName.trim().toUpperCase()] || {};
  const nextEntry = {
    gstin:
      gstin !== undefined
        ? gstin.trim().toUpperCase()
        : prev.gstin || "",
    contactPhone:
      contactPhone !== undefined
        ? contactPhone.trim()
        : prev.contactPhone || "",
  };
  map[companyId] = nextEntry;
  if (companyName.trim()) {
    map[companyName.trim().toUpperCase()] = nextEntry;
  }
  await prisma.setting.upsert({
    where: { key: "company_contacts" },
    update: { value: map as unknown as Prisma.InputJsonValue },
    create: { key: "company_contacts", value: map as unknown as Prisma.InputJsonValue },
  });
}

export class CrudService {
  private assertReadAccess(role: UserRole, entity: CrudEntityKey) {
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return;
    const cfg = CRUD_ENTITIES[entity];
    if (!cfg || !cfg.readRoles.includes(role)) {
      throw new ForbiddenError(`Role ${role} is not authorized to view ${entity}`);
    }
  }

  private assertWriteAccess(role: UserRole, entity: CrudEntityKey) {
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return;
    const cfg = CRUD_ENTITIES[entity];
    if (!cfg || !cfg.writeRoles.includes(role)) {
      throw new ForbiddenError(
        `Role ${role} is not authorized to modify ${entity}`
      );
    }
  }

  /**
   * Lists records for any entity in CRUD_ENTITIES.
   */
  async listRecords(
    actorRole: UserRole,
    entity: CrudEntityKey,
    options: CrudListOptions = {}
  ): Promise<Array<Record<string, unknown>>> {
    this.assertReadAccess(actorRole, entity);
    const includeArchived = Boolean(options.includeArchived);
    const q = options.search?.trim().toLowerCase() || "";

    switch (entity) {
      case "users": {
        const users = await prisma.user.findMany({
          where: {
            ...(includeArchived ? {} : { active: true }),
            ...(options.filterRole
              ? { role: options.filterRole as UserRole }
              : {}),
          },
          orderBy: { createdAt: "desc" },
        });
        return users
          .map((u) => ({
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email || "",
            role: u.role,
            buyerType: u.buyerType || "CUSTOMER",
            buyerApproved: u.buyerApproved,
            active: u.active,
            archived: !u.active,
          }))
          .filter(
            (r) =>
              !q ||
              r.name.toLowerCase().includes(q) ||
              r.phone.toLowerCase().includes(q) ||
              r.role.toLowerCase().includes(q)
          );
      }

      case "locations": {
        const locs = await prisma.location.findMany({
          where: includeArchived ? {} : { active: true },
          orderBy: { name: "asc" },
        });
        return locs
          .map((l) => ({
            id: l.id,
            name: l.name,
            type: l.type,
            active: l.active,
            archived: !l.active,
          }))
          .filter(
            (r) =>
              !q ||
              r.name.toLowerCase().includes(q) ||
              r.type.toLowerCase().includes(q)
          );
      }

      case "companies": {
        const [companies, contactsMap, suppliers] = await Promise.all([
          prisma.company.findMany({
            where: includeArchived ? {} : { active: true },
            orderBy: { name: "asc" },
          }),
          getCompanyContactsMap(),
          prisma.party.findMany({
            where: { type: PartyType.SUPPLIER },
            select: { name: true, gstin: true, phone: true },
          }),
        ]);
        const supplierByName = new Map(
          suppliers.map((s) => [s.name.trim().toUpperCase(), s])
        );
        return companies
          .map((c) => {
            const normName = c.name.trim().toUpperCase();
            const meta = contactsMap[c.id] || contactsMap[normName];
            const sup = supplierByName.get(normName);
            return {
              id: c.id,
              name: c.name,
              gstin: meta?.gstin || sup?.gstin || "",
              contactPhone: meta?.contactPhone || sup?.phone || "",
              active: c.active,
              archived: !c.active,
            };
          })
          .filter(
            (r) =>
              !q ||
              r.name.toLowerCase().includes(q) ||
              r.gstin.toLowerCase().includes(q) ||
              r.contactPhone.toLowerCase().includes(q)
          );
      }

      case "categories": {
        const categories = await prisma.category.findMany({
          where: includeArchived ? {} : { active: true },
          orderBy: { name: "asc" },
        });
        return categories
          .map((c) => ({
            id: c.id,
            name: c.name,
            active: c.active,
            archived: !c.active,
          }))
          .filter((r) => !q || r.name.toLowerCase().includes(q));
      }

      case "products": {
        const products = await prisma.product.findMany({
          where: includeArchived ? {} : { active: true },
          orderBy: { name: "asc" },
        });
        return products
          .map((p) => ({
            id: p.id,
            shortCode: p.shortCode,
            name: p.name,
            weight: p.weight || "",
            packSize: p.packSize,
            mrpRupees: toRupees(p.mrpPaise),
            priceARupees: toRupees(p.priceAPaise ?? p.priceCPaise),
            priceBRupees: toRupees(p.priceBPaise ?? p.priceCPaise),
            priceCRupees: toRupees(p.priceCPaise),
            reorderLevel: p.reorderLevel,
            active: p.active,
            archived: !p.active,
          }))
          .filter(
            (r) =>
              !q ||
              r.name.toLowerCase().includes(q) ||
              r.shortCode.toLowerCase().includes(q)
          );
      }

      case "price_slabs": {
        const slabs = await getJsonListSetting<{
          id: string;
          productId: string;
          productName?: string;
          minQty: number;
          maxQty?: number;
          priceRupees: number;
        }>("crud_price_slabs");
        return slabs.filter(
          (s) =>
            !q ||
            s.productId.toLowerCase().includes(q) ||
            (s.productName || "").toLowerCase().includes(q)
        );
      }

      case "parties": {
        const parties = await prisma.party.findMany({
          where: includeArchived ? {} : { active: true },
          orderBy: { name: "asc" },
        });
        return parties
          .map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            phone: p.phone || "",
            gstin: p.gstin || "",
            creditLimitRupees: toRupees(p.creditLimitPaise),
            address: p.address || "",
            active: p.active,
            archived: !p.active,
          }))
          .filter(
            (r) =>
              !q ||
              r.name.toLowerCase().includes(q) ||
              r.phone.toLowerCase().includes(q) ||
              r.type.toLowerCase().includes(q)
          );
      }

      case "orders": {
        const orders = await prisma.order.findMany({
          where: includeArchived
            ? {}
            : { status: { not: OrderStatus.CANCELLED } },
          include: { user: { select: { name: true, phone: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        return orders
          .map((o) => ({
            id: o.id,
            orderNo: o.orderNumber,
            buyerName: o.user?.name || o.contactPhone,
            status: o.status === "PROCESSING" ? "PACKING" : o.status === "DISPATCHED" ? "OUT_FOR_DELIVERY" : o.status,
            totalRupees: toRupees(o.totalPaise),
            notes: o.customerNotes || "",
            archived: o.status === OrderStatus.CANCELLED,
          }))
          .filter(
            (r) =>
              !q ||
              r.orderNo.toLowerCase().includes(q) ||
              r.buyerName.toLowerCase().includes(q)
          );
      }

      case "purchases": {
        const purchases = await prisma.purchase.findMany({
          where: includeArchived
            ? {}
            : { status: { not: PurchaseStatus.CANCELLED } },
          include: { supplier: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        return purchases
          .map((p) => ({
            id: p.id,
            billNo: p.billNo,
            supplierName: p.supplier?.name || "Direct Supplier",
            totalRupees: toRupees(p.totalPaise),
            notes: p.status,
            archived: p.status === PurchaseStatus.CANCELLED,
          }))
          .filter(
            (r) =>
              !q ||
              r.billNo.toLowerCase().includes(q) ||
              r.supplierName.toLowerCase().includes(q)
          );
      }

      case "stock_transfers": {
        const movements = await prisma.stockMovement.findMany({
          where: { type: MovementType.TRANSFER },
          include: {
            product: { select: { name: true, shortCode: true } },
            fromLocation: { select: { name: true } },
            toLocation: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        return movements
          .map((m) => ({
            id: m.id,
            productName: `[${m.product.shortCode}] ${m.product.name}`,
            fromLocationName: m.fromLocation?.name || "—",
            toLocationName: m.toLocation?.name || "—",
            qty: m.qty,
            reason: m.reason || "",
            archived: false,
          }))
          .filter(
            (r) =>
              !q ||
              r.productName.toLowerCase().includes(q) ||
              r.reason.toLowerCase().includes(q)
          );
      }

      case "van_trips": {
        const trips = await prisma.vanDay.findMany({
          include: {
            vanLocation: { select: { name: true } },
            salesperson: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: 200,
        });
        return trips
          .map((t) => ({
            id: t.id,
            vanName: t.vanLocation.name,
            salespersonName: t.salesperson.name,
            status: t.status,
            notes: t.notes || t.issueSheetNo,
            archived: t.status === VanDayStatus.CLOSED,
          }))
          .filter(
            (r) =>
              !q ||
              r.vanName.toLowerCase().includes(q) ||
              r.salespersonName.toLowerCase().includes(q)
          );
      }

      case "delivery_zones": {
        const zones = await getJsonListSetting<{
          id: string;
          name: string;
          pincode: string;
          estimatedHours: number;
          active: boolean;
        }>("delivery_zones");
        if (zones.length === 0) {
          return [
            {
              id: "zone-saharsa-town",
              name: "Saharsa Town Hub",
              pincode: "852201",
              estimatedHours: 2,
              active: true,
              archived: false,
            },
          ];
        }
        return zones.filter(
          (z) =>
            !q ||
            z.name.toLowerCase().includes(q) ||
            z.pincode.toLowerCase().includes(q)
        );
      }

      case "delivery_charge_rules": {
        const rules = await getJsonListSetting<{
          id: string;
          name: string;
          buyerType: string;
          minOrderRupees: number;
          chargeRupees: number;
          active: boolean;
        }>("delivery_charge_rules");
        if (rules.length === 0) {
          return [
            {
              id: "rule-default",
              name: "Saharsa Standard Delivery",
              buyerType: "ALL",
              minOrderRupees: 500,
              chargeRupees: 30,
              active: true,
              archived: false,
            },
          ];
        }
        return rules.filter((r) => !q || r.name.toLowerCase().includes(q));
      }

      case "receipts": {
        const receipts = await prisma.payment.findMany({
          include: { party: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        return receipts
          .map((r) => ({
            id: r.id,
            receiptNo: r.receiptNo || r.id.slice(0, 8).toUpperCase(),
            partyId: r.partyId || "",
            partyName: r.party?.name || "Walk-in / Counter",
            amountRupees: toRupees(r.amountPaise),
            mode: r.mode,
            reference: r.invoiceId || "",
            notes: r.notes || "",
            archived: (r.notes || "").startsWith("[VOIDED]"),
          }))
          .filter(
            (r) =>
              (includeArchived || !r.archived) &&
              (!q ||
                r.receiptNo.toLowerCase().includes(q) ||
                r.partyName.toLowerCase().includes(q))
          );
      }

      case "payments": {
        const payments = await getJsonListSetting<{
          id: string;
          voucherNo: string;
          payeeName: string;
          amountRupees: number;
          mode: string;
          notes: string;
          status: string;
          archived?: boolean;
        }>("supplier_payments");
        return payments.filter(
          (p) =>
            (includeArchived || !p.archived) &&
            (!q ||
              p.voucherNo.toLowerCase().includes(q) ||
              p.payeeName.toLowerCase().includes(q))
        );
      }

      case "discount_limits": {
        const row = await prisma.setting.findUnique({
          where: { key: "role_discount_limits" },
        });
        const val = (row?.value as Record<string, number>) || {
          SHOP: 500,
          SALESPERSON: 300,
          GODOWN: 0,
          ACCOUNTS: 0,
          DELIVERY: 0,
          CUSTOMER: 0,
          ADMIN: 10000,
          SUPER_ADMIN: 10000,
        };
        return Object.entries(val).map(([roleKey, bp]) => ({
          id: roleKey,
          role: roleKey,
          maxDiscountPct: Number((Number(bp) / 100).toFixed(2)),
          archived: false,
        }));
      }

      case "business_details": {
        const row = await prisma.setting.findUnique({
          where: { key: "business_details" },
        });
        const val = (row?.value as Record<string, unknown>) || {};
        return [
          {
            id: "business_details",
            tradeName: String(val.tradeName || "JMD Cart"),
            legalName: String(val.legalName || "Jai Mata Di Trading"),
            gstin: String(val.gstin || ""),
            fssai: String(val.fssai || ""),
            phone: String(val.phone || ""),
            address: String(val.address || "Saharsa, Bihar"),
            upiId: String(val.upiId || ""),
            archived: false,
          },
        ];
      }

      case "storefront_settings": {
        const banners = await getJsonListSetting<{
          id: string;
          title: string;
          subtitle: string;
          badgeText: string;
          ctaHref: string;
          active: boolean;
        }>("storefront_banners");
        if (banners.length === 0) {
          return [
            {
              id: "banner-saharsa-main",
              title: "Wholesale & Retail Distribution — Saharsa",
              subtitle: "Live Godown Stock • Same-Day Delivery in Saharsa Town",
              badgeText: "LIVE GODOWN STOCK",
              ctaHref: "/store",
              active: true,
              archived: false,
            },
          ];
        }
        return banners;
      }

      case "audit_logs": {
        const logs = await prisma.auditLog.findMany({
          include: { actor: { select: { name: true, role: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        return logs
          .map((l) => ({
            id: l.id,
            createdAt: l.createdAt.toISOString(),
            actorName: l.actor ? `${l.actor.name} (${l.actor.role})` : "System",
            action: l.action,
            entity: l.entity,
            entityId: l.entityId || "—",
            archived: false,
          }))
          .filter(
            (r) =>
              !q ||
              r.action.toLowerCase().includes(q) ||
              r.entity.toLowerCase().includes(q) ||
              r.actorName.toLowerCase().includes(q)
          );
      }
    }
  }

  /**
   * Creates a new record in the specified entity and writes an AuditLog entry.
   */
  async createRecord(
    actorRole: UserRole,
    actorId: string | null,
    entity: CrudEntityKey,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    this.assertWriteAccess(actorRole, entity);

    let createdRecord: Record<string, unknown>;

    switch (entity) {
      case "users": {
        const targetRole = (data.role as UserRole) || UserRole.SHOP;
        if (
          targetRole === UserRole.SUPER_ADMIN &&
          actorRole !== UserRole.SUPER_ADMIN
        ) {
          throw new ForbiddenError(
            "Only a SUPER_ADMIN can create another SUPER_ADMIN account"
          );
        }
        const rawPassword = String(data.password || "Welcome@123");
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        const created = await prisma.user.create({
          data: {
            name: String(data.name || "").trim(),
            phone: String(data.phone || "").trim(),
            role: targetRole,
            buyerType: (data.buyerType as PartyType) || PartyType.CUSTOMER,
            buyerApproved: Boolean(data.buyerApproved),
            passwordHash,
            active: data.active !== undefined ? Boolean(data.active) : true,
          },
        });
        createdRecord = { id: created.id, name: created.name, role: created.role };
        break;
      }

      case "locations": {
        const created = await prisma.location.create({
          data: {
            name: String(data.name || "").trim(),
            type: (data.type as LocationType) || LocationType.GODOWN,
            active: data.active !== undefined ? Boolean(data.active) : true,
          },
        });
        createdRecord = { ...created };
        break;
      }

      case "companies": {
        const name = String(data.name || "").trim();
        const gstin = String(data.gstin || "").trim().toUpperCase();
        const contactPhone = String(data.contactPhone || "").trim();
        const created = await prisma.company.create({
          data: {
            name,
            active: data.active !== undefined ? Boolean(data.active) : true,
          },
        });
        await ensureSupplierParty(created);
        if (gstin || contactPhone) {
          await saveCompanyContact(created.id, created.name, gstin, contactPhone);
        }
        createdRecord = { ...created, gstin, contactPhone };
        break;
      }

      case "categories": {
        const created = await prisma.category.create({
          data: {
            name: String(data.name || "").trim(),
            active: data.active !== undefined ? Boolean(data.active) : true,
          },
        });
        createdRecord = { ...created };
        break;
      }

      case "products": {
        const mrpPaise = data.mrpRupees ? toPaise(data.mrpRupees) : null;
        const priceAPaise = toPaise(data.priceARupees);
        const priceBPaise = toPaise(data.priceBRupees);
        const priceCPaise = toPaise(data.priceCRupees);

        const created = await prisma.product.create({
          data: {
            shortCode: String(data.shortCode || "").trim().toUpperCase(),
            name: String(data.name || "").trim(),
            weight: data.weight ? String(data.weight).trim() : null,
            packSize: Math.max(1, Number(data.packSize || 1)),
            mrpPaise,
            priceAPaise,
            priceBPaise,
            priceCPaise,
            reorderLevel: Math.max(0, Number(data.reorderLevel || 0)),
            active: data.active !== undefined ? Boolean(data.active) : true,
          },
        });
        createdRecord = { ...created };
        break;
      }

      case "price_slabs": {
        const slabs = await getJsonListSetting<{
          id: string;
          productId: string;
          productName?: string;
          minQty: number;
          maxQty?: number;
          priceRupees: number;
        }>("crud_price_slabs");
        const item = {
          id: `slab-${Date.now()}`,
          productId: String(data.productId || "").trim(),
          productName: String(data.productName || data.productId || ""),
          minQty: Math.max(1, Number(data.minQty || 1)),
          maxQty: data.maxQty ? Number(data.maxQty) : undefined,
          priceRupees: Number(data.priceRupees || 0),
        };
        slabs.push(item);
        await saveJsonListSetting("crud_price_slabs", slabs);
        createdRecord = item;
        break;
      }

      case "parties": {
        const creditLimitPaise = toPaise(data.creditLimitRupees);
        const created = await prisma.party.create({
          data: {
            name: String(data.name || "").trim(),
            type: (data.type as PartyType) || PartyType.CUSTOMER,
            phone: data.phone ? String(data.phone).trim() : null,
            gstin: data.gstin ? String(data.gstin).trim() : null,
            address: data.address ? String(data.address).trim() : null,
            creditEnabled: creditLimitPaise > 0,
            creditLimitPaise,
            active: data.active !== undefined ? Boolean(data.active) : true,
          },
        });
        createdRecord = { ...created };
        break;
      }

      case "delivery_zones": {
        const zones = await getJsonListSetting<{
          id: string;
          name: string;
          pincode: string;
          estimatedHours: number;
          active: boolean;
        }>("delivery_zones");
        const item = {
          id: `zone-${Date.now()}`,
          name: String(data.name || "").trim(),
          pincode: String(data.pincode || "").trim(),
          estimatedHours: Number(data.estimatedHours || 2),
          active: data.active !== undefined ? Boolean(data.active) : true,
        };
        zones.push(item);
        await saveJsonListSetting("delivery_zones", zones);
        createdRecord = item;
        break;
      }

      case "delivery_charge_rules": {
        const rules = await getJsonListSetting<{
          id: string;
          name: string;
          buyerType: string;
          minOrderRupees: number;
          chargeRupees: number;
          active: boolean;
        }>("delivery_charge_rules");
        const item = {
          id: `rule-${Date.now()}`,
          name: String(data.name || "").trim(),
          buyerType: String(data.buyerType || "ALL"),
          minOrderRupees: Number(data.minOrderRupees || 0),
          chargeRupees: Number(data.chargeRupees || 0),
          active: data.active !== undefined ? Boolean(data.active) : true,
        };
        rules.push(item);
        await saveJsonListSetting("delivery_charge_rules", rules);
        createdRecord = item;
        break;
      }

      case "receipts": {
        const amountPaise = toPaise(data.amountRupees);
        const modeVal =
          data.mode === "UPI"
            ? PaymentMode.UPI
            : data.mode === "BANK_TRANSFER"
            ? PaymentMode.CARD
            : PaymentMode.CASH;
        const created = await prisma.payment.create({
          data: {
            partyId: data.partyId ? String(data.partyId) : null,
            receiptNo: `RCP-${Date.now()}`,
            mode: modeVal,
            amountPaise,
            notes: data.notes ? String(data.notes) : null,
            receivedBy: actorId,
          },
        });
        createdRecord = { ...created };
        break;
      }

      case "payments": {
        const payments = await getJsonListSetting<{
          id: string;
          voucherNo: string;
          payeeName: string;
          amountRupees: number;
          mode: string;
          notes: string;
          status: string;
          archived?: boolean;
        }>("supplier_payments");
        const item = {
          id: `pay-${Date.now()}`,
          voucherNo: String(data.voucherNo || `VCH-${Date.now()}`),
          payeeName: String(data.payeeName || "").trim(),
          amountRupees: Number(data.amountRupees || 0),
          mode: String(data.mode || "CASH"),
          notes: String(data.notes || ""),
          status: "POSTED",
          archived: false,
        };
        payments.push(item);
        await saveJsonListSetting("supplier_payments", payments);
        createdRecord = item;
        break;
      }

      case "storefront_settings": {
        const banners = await getJsonListSetting<{
          id: string;
          title: string;
          subtitle: string;
          badgeText: string;
          ctaHref: string;
          active: boolean;
        }>("storefront_banners");
        const item = {
          id: `banner-${Date.now()}`,
          title: String(data.title || "").trim(),
          subtitle: String(data.subtitle || "").trim(),
          badgeText: String(data.badgeText || "OFFER"),
          ctaHref: String(data.ctaHref || "/store"),
          active: data.active !== undefined ? Boolean(data.active) : true,
        };
        banners.push(item);
        await saveJsonListSetting("storefront_banners", banners);
        createdRecord = item;
        break;
      }

      default:
        throw new Error(`Direct creation is not supported for ${entity}`);
    }

    await auditService.log({
      actorId,
      action: `CRUD_CREATE_${entity.toUpperCase()}`,
      entity,
      entityId: String(createdRecord.id || ""),
      after: createdRecord,
    });

    return createdRecord;
  }

  /**
   * Updates an existing record in the specified entity and writes an AuditLog entry.
   */
  async updateRecord(
    actorRole: UserRole,
    actorId: string | null,
    entity: CrudEntityKey,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    this.assertWriteAccess(actorRole, entity);

    let beforeRecord: unknown = null;
    let updatedRecord: Record<string, unknown>;

    switch (entity) {
      case "users": {
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) throw new Error("User not found");
        beforeRecord = { id: target.id, name: target.name, role: target.role, active: target.active };

        if (
          (target.role === UserRole.SUPER_ADMIN ||
            data.role === UserRole.SUPER_ADMIN) &&
          actorRole !== UserRole.SUPER_ADMIN
        ) {
          throw new ForbiddenError(
            "Only a SUPER_ADMIN can manage SUPER_ADMIN accounts"
          );
        }

        // Prevent demoting or deactivating the last SUPER_ADMIN
        if (
          target.role === UserRole.SUPER_ADMIN &&
          ((data.role && data.role !== UserRole.SUPER_ADMIN) ||
            data.active === false)
        ) {
          const otherSuperAdmins = await prisma.user.count({
            where: {
              role: UserRole.SUPER_ADMIN,
              active: true,
              id: { not: target.id },
            },
          });
          if (otherSuperAdmins === 0) {
            throw new Error(
              "Cannot demote or deactivate the last active SUPER_ADMIN account"
            );
          }
        }

        const updateData: Prisma.UserUpdateInput = {
          ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
          ...(data.phone !== undefined ? { phone: String(data.phone).trim() } : {}),
          ...(data.role !== undefined ? { role: data.role as UserRole } : {}),
          ...(data.buyerType !== undefined
            ? { buyerType: data.buyerType as PartyType }
            : {}),
          ...(data.buyerApproved !== undefined
            ? { buyerApproved: Boolean(data.buyerApproved) }
            : {}),
          ...(data.active !== undefined ? { active: Boolean(data.active) } : {}),
        };

        if (data.password && String(data.password).trim().length >= 6) {
          updateData.passwordHash = await bcrypt.hash(
            String(data.password).trim(),
            10
          );
        }

        const updated = await prisma.user.update({
          where: { id },
          data: updateData,
        });
        updatedRecord = { id: updated.id, name: updated.name, role: updated.role, active: updated.active };
        break;
      }

      case "locations": {
        const before = await prisma.location.findUnique({ where: { id } });
        beforeRecord = before;
        const updated = await prisma.location.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
            ...(data.type !== undefined
              ? { type: data.type as LocationType }
              : {}),
            ...(data.active !== undefined ? { active: Boolean(data.active) } : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      case "companies": {
        const before = await prisma.company.findUnique({ where: { id } });
        beforeRecord = before;
        const updated = await prisma.company.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
            ...(data.active !== undefined ? { active: Boolean(data.active) } : {}),
          },
        });
        await ensureSupplierParty(updated, undefined, { oldName: before?.name });
        if (data.gstin !== undefined || data.contactPhone !== undefined) {
          await saveCompanyContact(
            updated.id,
            updated.name,
            data.gstin !== undefined ? String(data.gstin) : undefined,
            data.contactPhone !== undefined ? String(data.contactPhone) : undefined
          );
        }
        const contacts = await getCompanyContactsMap();
        const meta =
          contacts[updated.id] ||
          contacts[updated.name.trim().toUpperCase()] ||
          {};
        updatedRecord = {
          ...updated,
          gstin: meta.gstin || "",
          contactPhone: meta.contactPhone || "",
        };
        break;
      }

      case "categories": {
        const before = await prisma.category.findUnique({ where: { id } });
        beforeRecord = before;
        const updated = await prisma.category.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
            ...(data.active !== undefined ? { active: Boolean(data.active) } : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      case "products": {
        const before = await prisma.product.findUnique({ where: { id } });
        beforeRecord = before;
        const updated = await prisma.product.update({
          where: { id },
          data: {
            ...(data.shortCode !== undefined
              ? { shortCode: String(data.shortCode).trim().toUpperCase() }
              : {}),
            ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
            ...(data.weight !== undefined
              ? { weight: data.weight ? String(data.weight).trim() : null }
              : {}),
            ...(data.packSize !== undefined
              ? { packSize: Math.max(1, Number(data.packSize)) }
              : {}),
            ...(data.mrpRupees !== undefined
              ? { mrpPaise: toPaise(data.mrpRupees) }
              : {}),
            ...(data.priceARupees !== undefined
              ? { priceAPaise: toPaise(data.priceARupees) }
              : {}),
            ...(data.priceBRupees !== undefined
              ? { priceBPaise: toPaise(data.priceBRupees) }
              : {}),
            ...(data.priceCRupees !== undefined
              ? { priceCPaise: toPaise(data.priceCRupees) }
              : {}),
            ...(data.reorderLevel !== undefined
              ? { reorderLevel: Math.max(0, Number(data.reorderLevel)) }
              : {}),
            ...(data.active !== undefined ? { active: Boolean(data.active) } : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      case "parties": {
        const before = await prisma.party.findUnique({ where: { id } });
        beforeRecord = before;
        const creditLimitPaise =
          data.creditLimitRupees !== undefined
            ? toPaise(data.creditLimitRupees)
            : before?.creditLimitPaise ?? 0;
        const updated = await prisma.party.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
            ...(data.type !== undefined ? { type: data.type as PartyType } : {}),
            ...(data.phone !== undefined
              ? { phone: data.phone ? String(data.phone).trim() : null }
              : {}),
            ...(data.gstin !== undefined
              ? { gstin: data.gstin ? String(data.gstin).trim() : null }
              : {}),
            ...(data.address !== undefined
              ? { address: data.address ? String(data.address).trim() : null }
              : {}),
            creditLimitPaise,
            creditEnabled: creditLimitPaise > 0,
            ...(data.active !== undefined ? { active: Boolean(data.active) } : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      case "orders": {
        const before = await prisma.order.findUnique({ where: { id } });
        beforeRecord = before;
        const rawStatus = String(data.status || before?.status || "PENDING");
        const mappedStatus: OrderStatus =
          rawStatus === "PACKING"
            ? OrderStatus.PROCESSING
            : rawStatus === "OUT_FOR_DELIVERY"
            ? OrderStatus.DISPATCHED
            : (rawStatus as OrderStatus);
        const updated = await prisma.order.update({
          where: { id },
          data: {
            status: mappedStatus,
            ...(data.notes !== undefined
              ? { customerNotes: String(data.notes) }
              : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      case "purchases": {
        const before = await prisma.purchase.findUnique({ where: { id } });
        beforeRecord = before;
        const updated = await prisma.purchase.update({
          where: { id },
          data: {
            ...(data.billNo !== undefined
              ? { billNo: String(data.billNo).trim() }
              : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      case "van_trips": {
        const before = await prisma.vanDay.findUnique({ where: { id } });
        beforeRecord = before;
        const updated = await prisma.vanDay.update({
          where: { id },
          data: {
            ...(data.status !== undefined
              ? { status: data.status as VanDayStatus }
              : {}),
            ...(data.notes !== undefined ? { notes: String(data.notes) } : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      case "discount_limits": {
        const row = await prisma.setting.findUnique({
          where: { key: "role_discount_limits" },
        });
        const current = (row?.value as Record<string, number>) || {};
        beforeRecord = { role: id, bp: current[id] };
        const pct = Math.max(0, Math.min(100, Number(data.maxDiscountPct || 0)));
        current[id] = Math.round(pct * 100);
        await prisma.setting.upsert({
          where: { key: "role_discount_limits" },
          update: { value: current as Prisma.InputJsonValue },
          create: { key: "role_discount_limits", value: current as Prisma.InputJsonValue },
        });
        updatedRecord = { id, role: id, maxDiscountPct: pct };
        break;
      }

      case "business_details": {
        const row = await prisma.setting.findUnique({
          where: { key: "business_details" },
        });
        const current = (row?.value as Record<string, unknown>) || {};
        beforeRecord = current;
        const nextVal = {
          ...current,
          ...(data.tradeName !== undefined ? { tradeName: String(data.tradeName) } : {}),
          ...(data.legalName !== undefined ? { legalName: String(data.legalName) } : {}),
          ...(data.gstin !== undefined ? { gstin: String(data.gstin) } : {}),
          ...(data.fssai !== undefined ? { fssai: String(data.fssai) } : {}),
          ...(data.phone !== undefined ? { phone: String(data.phone) } : {}),
          ...(data.address !== undefined ? { address: String(data.address) } : {}),
          ...(data.upiId !== undefined ? { upiId: String(data.upiId) } : {}),
        };
        await prisma.setting.upsert({
          where: { key: "business_details" },
          update: { value: nextVal as Prisma.InputJsonValue },
          create: { key: "business_details", value: nextVal as Prisma.InputJsonValue },
        });
        updatedRecord = { id: "business_details", ...nextVal };
        break;
      }

      case "price_slabs":
      case "delivery_zones":
      case "delivery_charge_rules":
      case "payments":
      case "storefront_settings": {
        const settingKeyMap: Record<string, string> = {
          price_slabs: "crud_price_slabs",
          delivery_zones: "delivery_zones",
          delivery_charge_rules: "delivery_charge_rules",
          payments: "supplier_payments",
          storefront_settings: "storefront_banners",
        };
        const sKey = settingKeyMap[entity];
        const list = await getJsonListSetting<Record<string, unknown> & { id: string }>(
          sKey
        );
        const idx = list.findIndex((i) => i.id === id);
        if (idx >= 0) {
          beforeRecord = list[idx];
          list[idx] = { ...list[idx], ...data, id };
          updatedRecord = list[idx];
        } else {
          updatedRecord = { id, ...data };
          list.push(updatedRecord as Record<string, unknown> & { id: string });
        }
        await saveJsonListSetting(sKey, list);
        break;
      }

      case "receipts": {
        const before = await prisma.payment.findUnique({ where: { id } });
        beforeRecord = before;
        const updated = await prisma.payment.update({
          where: { id },
          data: {
            ...(data.amountRupees !== undefined
              ? { amountPaise: toPaise(data.amountRupees) }
              : {}),
            ...(data.notes !== undefined ? { notes: String(data.notes) } : {}),
          },
        });
        updatedRecord = { ...updated };
        break;
      }

      default:
        throw new Error(`Update not supported for ${entity}`);
    }

    await auditService.log({
      actorId,
      action: `CRUD_UPDATE_${entity.toUpperCase()}`,
      entity,
      entityId: id,
      before: beforeRecord,
      after: updatedRecord,
    });

    return updatedRecord;
  }

  /**
   * Enforces the Part 5 Delete / Archive / Void policy:
   * - Entities with history or references are ARCHIVED or VOIDED (never hard-deleted).
   * - Entities with 0 references are hard-deleted.
   * - Users: cannot delete last SUPER_ADMIN or delete yourself.
   * - Writes an AuditLog entry with before, after, and reason.
   */
  async deleteOrArchiveRecord(
    actorRole: UserRole,
    actorId: string | null,
    entity: CrudEntityKey,
    id: string,
    reason?: string
  ): Promise<CrudDeleteResult> {
    this.assertWriteAccess(actorRole, entity);

    const cfg = CRUD_ENTITIES[entity];
    if (cfg.deletePolicy === "VOID_WITH_REASON") {
      if (!reason || reason.trim().length < 3) {
        throw new Error(
          `A mandatory reason (at least 3 characters) is required to cancel/void ${cfg.singularTitle}`
        );
      }
    }

    let actionTaken: "DELETED" | "ARCHIVED" | "VOIDED" = "ARCHIVED";
    let beforeSnapshot: unknown = null;

    switch (entity) {
      case "users": {
        if (actorId && id === actorId) {
          throw new Error("You cannot delete or archive your own user account");
        }
        const target = await prisma.user.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                createdInvoices: true,
                orders: true,
                auditLogs: true,
                importBatches: true,
              },
            },
          },
        });
        if (!target) throw new Error("User not found");
        beforeSnapshot = { id: target.id, name: target.name, role: target.role };

        if (
          target.role === UserRole.SUPER_ADMIN &&
          actorRole !== UserRole.SUPER_ADMIN
        ) {
          throw new ForbiddenError(
            "Only a SUPER_ADMIN can delete or archive a SUPER_ADMIN account"
          );
        }

        if (target.role === UserRole.SUPER_ADMIN) {
          const otherSuperAdmins = await prisma.user.count({
            where: {
              role: UserRole.SUPER_ADMIN,
              active: true,
              id: { not: target.id },
            },
          });
          if (otherSuperAdmins === 0) {
            throw new Error("Cannot delete or archive the last active SUPER_ADMIN");
          }
        }

        const refCount =
          target._count.createdInvoices +
          target._count.orders +
          target._count.auditLogs +
          target._count.importBatches;

        if (refCount > 0) {
          await prisma.user.update({
            where: { id },
            data: { active: false },
          });
          actionTaken = "ARCHIVED";
        } else {
          await prisma.user.delete({ where: { id } });
          actionTaken = "DELETED";
        }
        break;
      }

      case "companies": {
        const company = await prisma.company.findUnique({
          where: { id },
          include: { _count: { select: { products: true } } },
        });
        if (!company) throw new Error("Company not found");
        beforeSnapshot = company;
        if (company._count.products > 0) {
          await prisma.company.update({
            where: { id },
            data: { active: false },
          });
          await ensureSupplierParty({ id, name: company.name, active: false });
          actionTaken = "ARCHIVED";
        } else {
          await prisma.company.delete({ where: { id } });
          await ensureSupplierParty({ id, name: company.name, active: false });
          actionTaken = "DELETED";
        }
        break;
      }

      case "categories": {
        const category = await prisma.category.findUnique({
          where: { id },
          include: { _count: { select: { products: true } } },
        });
        if (!category) throw new Error("Category not found");
        beforeSnapshot = category;
        if (category._count.products > 0) {
          await prisma.category.update({
            where: { id },
            data: { active: false },
          });
          actionTaken = "ARCHIVED";
        } else {
          await prisma.category.delete({ where: { id } });
          actionTaken = "DELETED";
        }
        break;
      }

      case "locations": {
        const loc = await prisma.location.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                fromMovements: true,
                toMovements: true,
                invoices: true,
                purchases: true,
              },
            },
          },
        });
        if (!loc) throw new Error("Location not found");
        beforeSnapshot = loc;
        const refs =
          loc._count.fromMovements +
          loc._count.toMovements +
          loc._count.invoices +
          loc._count.purchases;
        if (refs > 0) {
          await prisma.location.update({
            where: { id },
            data: { active: false },
          });
          actionTaken = "ARCHIVED";
        } else {
          await prisma.location.delete({ where: { id } });
          actionTaken = "DELETED";
        }
        break;
      }

      case "products": {
        const prod = await prisma.product.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                stockMovements: true,
                invoiceItems: true,
                orderItems: true,
                purchaseItems: true,
              },
            },
          },
        });
        if (!prod) throw new Error("Product not found");
        beforeSnapshot = prod;
        const refs =
          prod._count.stockMovements +
          prod._count.invoiceItems +
          prod._count.orderItems +
          prod._count.purchaseItems;

        if (refs > 0) {
          await prisma.product.update({
            where: { id },
            data: { active: false },
          });
          actionTaken = "ARCHIVED";
        } else {
          await prisma.stockBalance.deleteMany({ where: { productId: id } });
          await prisma.product.delete({ where: { id } });
          actionTaken = "DELETED";
        }
        break;
      }

      case "parties": {
        const party = await prisma.party.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                invoices: true,
                purchases: true,
                ledgerEntries: true,
                payments: true,
              },
            },
          },
        });
        if (!party) throw new Error("Party not found");
        beforeSnapshot = party;
        const refs =
          party._count.invoices +
          party._count.purchases +
          party._count.ledgerEntries +
          party._count.payments;

        if (refs > 0) {
          await prisma.party.update({
            where: { id },
            data: { active: false },
          });
          actionTaken = "ARCHIVED";
        } else {
          await prisma.party.delete({ where: { id } });
          actionTaken = "DELETED";
        }
        break;
      }

      case "orders": {
        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) throw new Error("Order not found");
        beforeSnapshot = order;
        await prisma.order.update({
          where: { id },
          data: {
            status: OrderStatus.CANCELLED,
            customerNotes: `[VOIDED: ${reason}] ${order.customerNotes || ""}`.trim(),
          },
        });
        actionTaken = "VOIDED";
        break;
      }

      case "purchases": {
        const purchase = await prisma.purchase.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!purchase) throw new Error("Purchase not found");
        beforeSnapshot = purchase;

        await prisma.$transaction(async (tx) => {
          for (const item of purchase.items) {
            const cur = await stockRepository.lockAndGetBalance(
              tx,
              item.productId,
              purchase.locationId
            );
            if (cur < item.qty) {
              throw new Error(
                `Cannot void purchase ${purchase.billNo}: insufficient stock to reverse item ${item.productId}`
              );
            }
            await stockRepository.setBalance(
              tx,
              item.productId,
              purchase.locationId,
              cur - item.qty
            );
            await tx.stockMovement.create({
              data: {
                type: MovementType.ADJUSTMENT,
                productId: item.productId,
                fromLocationId: purchase.locationId,
                qty: item.qty,
                referenceType: "PURCHASE_VOID",
                referenceId: purchase.id,
                reason: `Void Purchase ${purchase.billNo}: ${reason}`,
                idempotencyKey: `void-pur-${purchase.id}-${item.id}`,
                createdBy: actorId,
              },
            });
          }

          await tx.purchase.update({
            where: { id },
            data: { status: PurchaseStatus.CANCELLED },
          });
        });

        actionTaken = "VOIDED";
        break;
      }

      case "stock_transfers": {
        const mov = await prisma.stockMovement.findUnique({ where: { id } });
        if (!mov) throw new Error("Transfer movement not found");
        beforeSnapshot = mov;

        await prisma.$transaction(async (tx) => {
          if (mov.toLocationId) {
            const dstBal = await stockRepository.lockAndGetBalance(
              tx,
              mov.productId,
              mov.toLocationId
            );
            if (dstBal < mov.qty) {
              throw new Error(
                "Cannot reverse transfer: destination stock has already been consumed"
              );
            }
            await stockRepository.setBalance(
              tx,
              mov.productId,
              mov.toLocationId,
              dstBal - mov.qty
            );
          }
          if (mov.fromLocationId) {
            const srcBal = await stockRepository.lockAndGetBalance(
              tx,
              mov.productId,
              mov.fromLocationId
            );
            await stockRepository.setBalance(
              tx,
              mov.productId,
              mov.fromLocationId,
              srcBal + mov.qty
            );
          }

          await tx.stockMovement.create({
            data: {
              type: MovementType.TRANSFER,
              productId: mov.productId,
              fromLocationId: mov.toLocationId,
              toLocationId: mov.fromLocationId,
              qty: mov.qty,
              referenceType: "TRANSFER_VOID",
              referenceId: mov.id,
              reason: `Reverse Transfer: ${reason}`,
              idempotencyKey: `rev-transfer-${mov.id}-${Date.now()}`,
              createdBy: actorId,
            },
          });
        });
        actionTaken = "VOIDED";
        break;
      }

      case "van_trips": {
        const trip = await prisma.vanDay.findUnique({ where: { id } });
        if (!trip) throw new Error("Van trip not found");
        beforeSnapshot = trip;
        await prisma.vanDay.update({
          where: { id },
          data: {
            status: VanDayStatus.CLOSED,
            notes: `[VOIDED: ${reason}] ${trip.notes || ""}`.trim(),
          },
        });
        actionTaken = "VOIDED";
        break;
      }

      case "receipts": {
        const rec = await prisma.payment.findUnique({ where: { id } });
        if (!rec) throw new Error("Receipt not found");
        beforeSnapshot = rec;
        await prisma.payment.update({
          where: { id },
          data: {
            notes: `[VOIDED: ${reason}] ${rec.notes || ""}`.trim(),
          },
        });
        actionTaken = "VOIDED";
        break;
      }

      case "payments": {
        const payments = await getJsonListSetting<{
          id: string;
          status: string;
          notes: string;
          archived?: boolean;
        }>("supplier_payments");
        const idx = payments.findIndex((p) => p.id === id);
        if (idx >= 0) {
          beforeSnapshot = payments[idx];
          payments[idx] = {
            ...payments[idx],
            status: "VOIDED",
            notes: `[VOIDED: ${reason}] ${payments[idx].notes || ""}`,
            archived: true,
          };
          await saveJsonListSetting("supplier_payments", payments);
        }
        actionTaken = "VOIDED";
        break;
      }

      case "price_slabs":
      case "delivery_zones":
      case "delivery_charge_rules":
      case "storefront_settings": {
        const settingKeyMap: Record<string, string> = {
          price_slabs: "crud_price_slabs",
          delivery_zones: "delivery_zones",
          delivery_charge_rules: "delivery_charge_rules",
          storefront_settings: "storefront_banners",
        };
        const sKey = settingKeyMap[entity];
        const list = await getJsonListSetting<{ id: string }>(sKey);
        beforeSnapshot = list.find((i) => i.id === id);
        const filtered = list.filter((i) => i.id !== id);
        await saveJsonListSetting(sKey, filtered);
        actionTaken = "DELETED";
        break;
      }

      default:
        throw new Error(`Delete/Archive is not supported for ${entity}`);
    }

    await auditService.log({
      actorId,
      action: `CRUD_${actionTaken}_${entity.toUpperCase()}`,
      entity,
      entityId: id,
      before: beforeSnapshot,
      after: { action: actionTaken, reason: reason || null },
    });

    return { action: actionTaken, id };
  }

  /**
   * Restores an archived record (sets active = true) and writes an AuditLog entry.
   */
  async restoreRecord(
    actorRole: UserRole,
    actorId: string | null,
    entity: CrudEntityKey,
    id: string
  ): Promise<void> {
    this.assertWriteAccess(actorRole, entity);

    switch (entity) {
      case "users":
        await prisma.user.update({ where: { id }, data: { active: true } });
        break;
      case "locations":
        await prisma.location.update({ where: { id }, data: { active: true } });
        break;
      case "companies": {
        const restored = await prisma.company.update({ where: { id }, data: { active: true } });
        await ensureSupplierParty(restored);
        break;
      }
      case "categories":
        await prisma.category.update({ where: { id }, data: { active: true } });
        break;
      case "products":
        await prisma.product.update({ where: { id }, data: { active: true } });
        break;
      case "parties":
        await prisma.party.update({ where: { id }, data: { active: true } });
        break;
      default:
        throw new Error(`Restore is not supported for ${entity}`);
    }

    await auditService.log({
      actorId,
      action: `CRUD_RESTORED_${entity.toUpperCase()}`,
      entity,
      entityId: id,
      after: { active: true },
    });
  }
}

export const crudService = new CrudService();

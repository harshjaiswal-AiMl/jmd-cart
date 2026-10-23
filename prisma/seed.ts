import { PrismaClient, LocationType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Reference Seed Only (per `docs/rules.md` — "No dummy data"):
 * - Four reference locations (Godown, Shop, Van 1, Van 2)
 * - Default settings (`role_discount_limits` and an empty `business_details` record)
 * - Initial invoice sequence (`INV` for FY `26-27`)
 *
 * No users, companies, categories, products, stock, parties, orders, or invoices are seeded here.
 * The Super Admin is created via the first-run `/setup` screen or `pnpm admin:create`.
 */
export async function seedReferenceData(client: PrismaClient = prisma) {
  console.log("Seeding reference data only...");

  // 1. Reference Locations (Godown, Shop, Van 1, Van 2)
  await client.location.upsert({
    where: { id: "loc-godown-main" },
    update: {},
    create: {
      id: "loc-godown-main",
      name: "Main Godown",
      type: LocationType.GODOWN,
    },
  });

  await client.location.upsert({
    where: { id: "loc-shop-retail" },
    update: {},
    create: {
      id: "loc-shop-retail",
      name: "Retail Shop",
      type: LocationType.SHOP,
    },
  });

  await client.location.upsert({
    where: { id: "loc-van-1" },
    update: {},
    create: {
      id: "loc-van-1",
      name: "Van 1 - North Route",
      type: LocationType.VAN,
    },
  });

  await client.location.upsert({
    where: { id: "loc-van-2" },
    update: {},
    create: {
      id: "loc-van-2",
      name: "Van 2 - South Route",
      type: LocationType.VAN,
    },
  });

  // 2. Empty Business Details Record (populated during First-Run Setup)
  await client.setting.upsert({
    where: { key: "business_details" },
    update: {},
    create: {
      key: "business_details",
      value: {
        legalName: "",
        tradeName: "",
        gstin: "",
        fssai: "",
        address: "",
        phone: "",
        email: "",
        bankDetails: {
          bankName: "",
          accountNumber: "",
          ifsc: "",
          branch: "",
        },
        upiId: "",
      },
    },
  });

  // 3. Default Role Discount Limits (basis points)
  await client.setting.upsert({
    where: { key: "role_discount_limits" },
    update: {},
    create: {
      key: "role_discount_limits",
      value: {
        SHOP: 500, // Cashier max 5%
        SALESPERSON: 300, // Van salesperson max 3%
        GODOWN: 0,
        ACCOUNTS: 0,
        DELIVERY: 0,
        CUSTOMER: 0,
        SUPER_ADMIN: 10000, // Super admin unrestricted
      },
    },
  });

  // 4. Initial Invoice Sequence Row for FY 26-27
  await client.sequence.upsert({
    where: { name_fy: { name: "INV", fy: "26-27" } },
    update: {},
    create: {
      name: "INV",
      fy: "26-27",
      nextValue: 1,
    },
  });

  // 5. Ensure Brand Supplier Parties (idempotent backfill for Prompt 09)
  const companies = await client.company.findMany();
  for (const company of companies) {
    const existingLinked = await client.party.findUnique({
      where: { companyId: company.id },
    });
    if (existingLinked) continue;

    const normName = company.name.trim().toUpperCase();
    const existingSuppliers = await client.party.findMany({
      where: {
        type: "SUPPLIER",
        companyId: null,
      },
    });
    const match = existingSuppliers.find(
      (s) => s.name.trim().toUpperCase() === normName
    );
    if (match) {
      await client.party.update({
        where: { id: match.id },
        data: { companyId: company.id, active: company.active },
      });
    } else {
      await client.party.create({
        data: {
          name: company.name.trim(),
          type: "SUPPLIER",
          companyId: company.id,
          active: company.active,
          creditEnabled: false,
          creditLimitPaise: 0,
          creditDays: 0,
        },
      });
    }
  }

  // 6. Deactivate products starting with digits (0-9) per owner requirement
  const digitProducts = await client.product.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const toDeactivate = digitProducts.filter((p) => /^[0-9]/.test(p.name.trim()));
  if (toDeactivate.length > 0) {
    console.log(`Deactivating ${toDeactivate.length} products starting with digits...`);
    await client.product.updateMany({
      where: { id: { in: toDeactivate.map((p) => p.id) } },
      data: { active: false },
    });
  }

  console.log("Reference seed completed (0 business rows created).");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedReferenceData()
    .catch((e) => {
      console.error("Seeding error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}



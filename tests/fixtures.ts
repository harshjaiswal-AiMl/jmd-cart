import { PrismaClient, UserRole, LocationType, PartyType } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Test-only fixtures (per `docs/rules.md` — "Test data lives only in `tests/` and runs against
 * an isolated test database that is created and destroyed by the test run. Fixtures are never
 * loaded into the app database.")
 */
export async function seedTestFixtures(prisma: PrismaClient) {
  const defaultSaltRounds = 10;
  const adminPassword = await bcrypt.hash("admin123", defaultSaltRounds);
  const godownPassword = await bcrypt.hash("godown123", defaultSaltRounds);
  const shopPassword = await bcrypt.hash("shop123", defaultSaltRounds);
  const salesPassword = await bcrypt.hash("van123", defaultSaltRounds);
  const deliveryPassword = await bcrypt.hash("delivery123", defaultSaltRounds);
  const accountsPassword = await bcrypt.hash("accounts123", defaultSaltRounds);

  await prisma.user.upsert({
    where: { phone: "9876543210" },
    update: {},
    create: {
      name: "Sachin Prakash",
      phone: "9876543210",
      email: "owner@idms.local",
      passwordHash: adminPassword,
      role: UserRole.SUPER_ADMIN,
    },
  });

  const godownUser = await prisma.user.upsert({
    where: { phone: "9876543211" },
    update: {},
    create: {
      name: "Ramesh Kumar",
      phone: "9876543211",
      email: "godown@idms.local",
      passwordHash: godownPassword,
      role: UserRole.GODOWN,
    },
  });

  const shopUser = await prisma.user.upsert({
    where: { phone: "9876543212" },
    update: {},
    create: {
      name: "Suresh Singh",
      phone: "9876543212",
      email: "shop@idms.local",
      passwordHash: shopPassword,
      role: UserRole.SHOP,
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { phone: "9876543213" },
    update: {},
    create: {
      name: "Ajay Verma",
      phone: "9876543213",
      email: "sales@idms.local",
      passwordHash: salesPassword,
      role: UserRole.SALESPERSON,
    },
  });

  await prisma.user.upsert({
    where: { phone: "9876543214" },
    update: {},
    create: {
      name: "Vijay Sharma",
      phone: "9876543214",
      email: "delivery@idms.local",
      passwordHash: deliveryPassword,
      role: UserRole.DELIVERY,
    },
  });

  await prisma.user.upsert({
    where: { phone: "9876543215" },
    update: {},
    create: {
      name: "Pooja Devi",
      phone: "9876543215",
      email: "accounts@idms.local",
      passwordHash: accountsPassword,
      role: UserRole.ACCOUNTS,
    },
  });

  await prisma.location.upsert({
    where: { id: "loc-godown-main" },
    update: { assignedUserId: godownUser.id },
    create: {
      id: "loc-godown-main",
      name: "Main Godown",
      type: LocationType.GODOWN,
      assignedUserId: godownUser.id,
    },
  });

  await prisma.location.upsert({
    where: { id: "loc-shop-retail" },
    update: { assignedUserId: shopUser.id },
    create: {
      id: "loc-shop-retail",
      name: "Retail Shop",
      type: LocationType.SHOP,
      assignedUserId: shopUser.id,
    },
  });

  await prisma.location.upsert({
    where: { id: "loc-van-1" },
    update: { assignedUserId: salesUser.id },
    create: {
      id: "loc-van-1",
      name: "Van 1 - North Route",
      type: LocationType.VAN,
      assignedUserId: salesUser.id,
    },
  });

  await prisma.location.upsert({
    where: { id: "loc-van-2" },
    update: {},
    create: {
      id: "loc-van-2",
      name: "Van 2 - South Route",
      type: LocationType.VAN,
    },
  });

  const bikaji = await prisma.company.upsert({
    where: { name: "Bikaji Foods" },
    update: {},
    create: { name: "Bikaji Foods" },
  });

  const mdh = await prisma.company.upsert({
    where: { name: "MDH Spices" },
    update: {},
    create: { name: "MDH Spices" },
  });

  const indiaGate = await prisma.company.upsert({
    where: { name: "India Gate" },
    update: {},
    create: { name: "India Gate" },
  });

  const engine = await prisma.company.upsert({
    where: { name: "Engine Mustard Oil" },
    update: {},
    create: { name: "Engine Mustard Oil" },
  });

  const catSnacks = await prisma.category.upsert({
    where: { name: "Namkeen & Snacks" },
    update: {},
    create: { name: "Namkeen & Snacks" },
  });

  const catSpices = await prisma.category.upsert({
    where: { name: "Spices & Masala" },
    update: {},
    create: { name: "Spices & Masala" },
  });

  const catGrains = await prisma.category.upsert({
    where: { name: "Rice & Grains" },
    update: {},
    create: { name: "Rice & Grains" },
  });

  const catOils = await prisma.category.upsert({
    where: { name: "Edible Oils" },
    update: {},
    create: { name: "Edible Oils" },
  });

  const testProducts = [
    {
      name: "Bikaji Bhujia 1kg",
      shortCode: "BKJ-BHU-1K",
      companyId: bikaji.id,
      categoryId: catSnacks.id,
      hsn: "21069099",
      gstRateBp: 1200,
      mrpPaise: 25000,
      packSize: 20,
      packLabel: "Carton",
      reorderLevel: 50,
    },
    {
      name: "Bikaji Rasgulla 1kg",
      shortCode: "BKJ-RAS-1K",
      companyId: bikaji.id,
      categoryId: catSnacks.id,
      hsn: "21069099",
      gstRateBp: 500,
      mrpPaise: 22000,
      packSize: 12,
      packLabel: "Carton",
      reorderLevel: 24,
    },
    {
      name: "MDH Deggi Mirch 100g",
      shortCode: "MDH-DEG-100",
      companyId: mdh.id,
      categoryId: catSpices.id,
      hsn: "09042010",
      gstRateBp: 500,
      mrpPaise: 9500,
      packSize: 24,
      packLabel: "Carton",
      reorderLevel: 48,
    },
    {
      name: "MDH Chana Masala 100g",
      shortCode: "MDH-CHN-100",
      companyId: mdh.id,
      categoryId: catSpices.id,
      hsn: "09109100",
      gstRateBp: 500,
      mrpPaise: 9000,
      packSize: 24,
      packLabel: "Carton",
      reorderLevel: 48,
    },
    {
      name: "India Gate Basmati Rice 5kg",
      shortCode: "IG-BAS-5K",
      companyId: indiaGate.id,
      categoryId: catGrains.id,
      hsn: "10063020",
      gstRateBp: 500,
      mrpPaise: 65000,
      packSize: 4,
      packLabel: "Bag",
      reorderLevel: 20,
    },
    {
      name: "Engine Mustard Oil 1L",
      shortCode: "ENG-OIL-1L",
      companyId: engine.id,
      categoryId: catOils.id,
      hsn: "15149100",
      gstRateBp: 500,
      mrpPaise: 17500,
      packSize: 15,
      packLabel: "Tin/Carton",
      reorderLevel: 30,
    },
  ];

  for (const prod of testProducts) {
    await prisma.product.upsert({
      where: { shortCode: prod.shortCode },
      update: {},
      create: prod,
    });
  }

  await prisma.party.upsert({
    where: { id: "party-sup-bikaji" },
    update: {},
    create: {
      id: "party-sup-bikaji",
      type: PartyType.SUPPLIER,
      name: "Bikaji Foods International Ltd",
      phone: "01512499999",
      gstin: "08AAACB1234F1Z1",
      address: "F-198, Bichhwal Industrial Area, Bikaner, Rajasthan",
    },
  });

  await prisma.party.upsert({
    where: { id: "party-ret-gupta" },
    update: {},
    create: {
      id: "party-ret-gupta",
      type: PartyType.RETAILER,
      name: "Gupta Kirana Store",
      phone: "9801234567",
      gstin: "10ABCPG1234A1Z9",
      address: "Bara Bazar, Saharsa",
      creditEnabled: true,
      creditLimitPaise: 5000000,
      creditDays: 14,
      tallyRef: "GUPTA_KIRANA_SAHARSA",
    },
  });

  await prisma.setting.upsert({
    where: { key: "business_details" },
    update: {
      value: {
        legalName: "JMD Cart Distributors",
        tradeName: "JMD Cart",
        gstin: "10AAAAA0000A1Z5",
        fssai: "10421000000001",
        address: "Station Road, Saharsa, Bihar - 852201",
        phone: "9876543210",
        email: "contact@jmdcart.local",
      },
    },
    create: {
      key: "business_details",
      value: {
        legalName: "JMD Cart Distributors",
        tradeName: "JMD Cart",
        gstin: "10AAAAA0000A1Z5",
        fssai: "10421000000001",
        address: "Station Road, Saharsa, Bihar - 852201",
        phone: "9876543210",
        email: "contact@jmdcart.local",
      },
    },
  });
}

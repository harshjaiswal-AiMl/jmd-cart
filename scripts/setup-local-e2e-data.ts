import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  throw new Error("REFUSED: setup-local-e2e-data.ts may only run against a localhost database!");
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("e2eadmin123", 10);
  await prisma.user.upsert({
    where: { phone: "9999900001" },
    update: {
      name: "E2E Test Super Admin",
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      active: true,
      mustChangePassword: false,
    },
    create: {
      name: "E2E Test Super Admin",
      phone: "9999900001",
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      active: true,
      mustChangePassword: false,
    },
  });
  console.log("Local E2E Super Admin ready (phone: 9999900001)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

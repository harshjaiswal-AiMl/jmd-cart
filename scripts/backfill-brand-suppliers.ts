import { prisma } from "../src/lib/prisma";
import { PartyType } from "@prisma/client";

export async function backfillBrandSuppliers() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
  });

  let linkedCount = 0;
  let createdCount = 0;
  let alreadyLinkedCount = 0;

  for (const company of companies) {
    const existingLinked = await prisma.party.findUnique({
      where: { companyId: company.id },
    });

    if (existingLinked) {
      alreadyLinkedCount++;
      continue;
    }

    const normName = company.name.trim().toUpperCase();

    // Check if an unlinked supplier party exists with the same name
    const existingSuppliers = await prisma.party.findMany({
      where: {
        type: PartyType.SUPPLIER,
        companyId: null,
      },
    });

    const match = existingSuppliers.find(
      (s) => s.name.trim().toUpperCase() === normName
    );

    if (match) {
      await prisma.party.update({
        where: { id: match.id },
        data: {
          companyId: company.id,
          active: company.active,
        },
      });
      linkedCount++;
    } else {
      await prisma.party.create({
        data: {
          name: company.name.trim(),
          type: PartyType.SUPPLIER,
          companyId: company.id,
          active: company.active,
          creditEnabled: false,
          creditLimitPaise: 0,
          creditDays: 0,
        },
      });
      createdCount++;
    }
  }

  return {
    totalCompanies: companies.length,
    alreadyLinked: alreadyLinkedCount,
    linkedExisting: linkedCount,
    createdNew: createdCount,
  };
}

if (process.argv[1]?.endsWith("backfill-brand-suppliers.ts")) {
  backfillBrandSuppliers()
    .then((res) => {
      console.log("Brand suppliers backfill complete:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}

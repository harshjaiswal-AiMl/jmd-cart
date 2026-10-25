import { setupService } from "../src/modules/auth/setup.service";
import { prisma } from "../src/lib/prisma";

/**
 * CLI script (`pnpm admin:create`) to create the initial Super Admin account and business details
 * when no Super Admin exists in the database.
 *
 * Usage:
 *   pnpm admin:create --name="Owner Name" --phone="9000000000" --password="StrongPassword123" --legalName="JMD Cart" --tradeName="JMD Cart" --address="Saharsa, Bihar"
 * Or via environment variables:
 *   ADMIN_NAME, ADMIN_PHONE, ADMIN_PASSWORD, ADMIN_EMAIL, BUSINESS_LEGAL_NAME, BUSINESS_TRADE_NAME, BUSINESS_ADDRESS, BUSINESS_GSTIN, BUSINESS_FSSAI
 */
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      if (key && rest.length > 0) {
        args[key] = rest.join("=").replace(/^["']|["']$/g, "");
      }
    }
  }
  return args;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));

  const name = cli.name || process.env.ADMIN_NAME || "";
  const phone = cli.phone || process.env.ADMIN_PHONE || "";
  const password = cli.password || process.env.ADMIN_PASSWORD || "";
  const email = cli.email || process.env.ADMIN_EMAIL || "";
  const legalName = cli.legalName || process.env.BUSINESS_LEGAL_NAME || "JMD Cart";
  const tradeName = cli.tradeName || process.env.BUSINESS_TRADE_NAME || "JMD Cart";
  const address = cli.address || process.env.BUSINESS_ADDRESS || "Saharsa, Bihar";
  const gstin = cli.gstin || process.env.BUSINESS_GSTIN || "";
  const fssai = cli.fssai || process.env.BUSINESS_FSSAI || "";

  if (!name || !phone || !password) {
    console.error(
      "Usage: pnpm admin:create --name=\"Owner Name\" --phone=\"10DigitPhone\" --password=\"Min8CharsPassword\" [--legalName=\"JMD Cart\"] [--address=\"Saharsa, Bihar\"]"
    );
    process.exit(1);
  }

  const res = await setupService.completeFirstRunSetup({
    ownerName: name,
    ownerPhone: phone,
    ownerEmail: email,
    ownerPassword: password,
    legalName,
    tradeName,
    gstin,
    fssai,
    address,
    businessPhone: phone,
    businessEmail: email,
  });

  console.log(`Super Admin created successfully: ${res.user.name} (${res.user.phone})`);
}

main()
  .catch((err) => {
    console.error("Failed to create Super Admin:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

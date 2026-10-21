// Called before db:reset and db:seed to prevent running against non-local databases
// Usage: tsx scripts/guard-local-db.ts [--i-know-this-is-not-local]
import "dotenv/config";

export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"];
export const BYPASS_FLAG = "--i-know-this-is-not-local";

export function isLocalDatabaseHost(url: string): boolean {
  try {
    const rawHostname = new URL(url).hostname;
    const hostname = rawHostname.replace(/^\[|\]$/g, "");
    return LOCAL_HOSTS.includes(hostname) || LOCAL_HOSTS.includes(rawHostname);
  } catch {
    return false;
  }
}

export function validateDatabaseHost(
  url: string = process.env.DATABASE_URL || "",
  args: string[] = process.argv
): { ok: boolean; reason?: string } {
  if (args.includes(BYPASS_FLAG)) {
    return { ok: true };
  }

  let hostname = "unknown";
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { ok: false, reason: "Could not parse DATABASE_URL" };
  }

  const cleanHost = hostname.replace(/^\[|\]$/g, "");
  if (!LOCAL_HOSTS.includes(cleanHost) && !LOCAL_HOSTS.includes(hostname)) {
    return {
      ok: false,
      reason: `BLOCKED: DATABASE_URL points to non-local host "${hostname}".`,
    };
  }

  return { ok: true };
}

// Execute when invoked directly from command line
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("guard-local-db.ts") ||
    process.argv[1].endsWith("guard-local-db.js") ||
    process.argv[1].includes("guard-local-db"));

if (isDirectRun) {
  const result = validateDatabaseHost();
  if (!result.ok) {
    console.error(`[guard-local-db] ${result.reason}`);
    console.error(
      `This script refuses to run against a remote database without the ${BYPASS_FLAG} flag.`
    );
    console.error(
      `If you REALLY want to run this against production, add: ${BYPASS_FLAG}`
    );
    process.exit(1);
  }
  console.log("[guard-local-db] Local database confirmed. Proceeding...");
}

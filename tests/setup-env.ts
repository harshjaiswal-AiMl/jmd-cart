import dotenv from "dotenv";

dotenv.config();

const rawUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/idms?schema=public";

// Ensure tests always run against the isolated `idms_test` database, never `idms`
const parsed = new URL(rawUrl);
const dbName = parsed.pathname.replace(/^\//, "");
if (!dbName.endsWith("_test")) {
  parsed.pathname = `/${dbName}_test`;
}

process.env.DATABASE_URL = parsed.toString();
process.env.TEST_DATABASE_URL = parsed.toString();

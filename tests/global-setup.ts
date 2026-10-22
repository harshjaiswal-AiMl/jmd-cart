import { Client } from "pg";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { seedTestFixtures } from "./fixtures";

dotenv.config();

function getTestDbConfig() {
  const rawUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/idms?schema=public";

  const parsed = new URL(rawUrl);
  const baseDbName = parsed.pathname.replace(/^\//, "");
  const testDbName = baseDbName.endsWith("_test") ? baseDbName : `${baseDbName}_test`;

  const adminUrl = new URL(rawUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const testUrl = new URL(rawUrl);
  testUrl.pathname = `/${testDbName}`;

  return {
    adminUrl: adminUrl.toString(),
    testUrl: testUrl.toString(),
    testDbName,
  };
}

export async function setup() {
  const { adminUrl, testUrl, testDbName } = getTestDbConfig();

  process.env.DATABASE_URL = testUrl;
  process.env.TEST_DATABASE_URL = testUrl;

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // Terminate any lingering connections to the test DB and recreate it fresh
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName]
    );
    await client.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await client.query(`CREATE DATABASE "${testDbName}"`);
  } finally {
    await client.end();
  }

  // Run migrations and reference seed on the isolated test database
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });

  execSync("npx tsx prisma/seed.ts", {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });

  // Load test fixtures into the isolated test database only
  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
  try {
    await seedTestFixtures(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown() {
  const { adminUrl, testDbName } = getTestDbConfig();
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName]
    );
    await client.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
  } finally {
    await client.end();
  }
}

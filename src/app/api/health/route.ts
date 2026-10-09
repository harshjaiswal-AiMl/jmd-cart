import { NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function GET() {
  let dbStatus = "unknown";
  try {
    const p = getPool();
    await p.query("SELECT 1");
    dbStatus = "connected";
  } catch (error) {
    dbStatus = `disconnected: ${(error as Error).message}`;
  }

  const isHealthy = dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: process.uptime(),
    },
    { status: isHealthy ? 200 : 503 }
  );
}

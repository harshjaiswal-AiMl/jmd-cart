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
  let isDbOk = false;
  try {
    const p = getPool();
    await p.query("SELECT 1");
    isDbOk = true;
  } catch {
    isDbOk = false;
  }

  if (isDbOk) {
    return NextResponse.json(
      { status: "ok", db: "ok" },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { status: "error", db: "error" },
    { status: 503 }
  );
}

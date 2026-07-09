import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260703203000_agent_flows_foundation",
  "migration.sql",
);
const sql = await readFile(migrationPath, "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

try {
  await pool.query(sql);
  console.log("Agent flows schema is aligned.");
} finally {
  await pool.end();
}

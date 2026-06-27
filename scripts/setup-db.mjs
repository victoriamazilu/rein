import "dotenv/config";
import { readFileSync } from "node:fs";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const migrationPath = "supabase/migrations/001_agent_commits.sql";
const sql = readFileSync(migrationPath, "utf-8");

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log(`Applying ${migrationPath}...`);
  await client.connect();
  await client.query(sql);
  console.log("Database setup complete.");
} catch (err) {
  console.error("Database setup failed:");
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

import "dotenv/config";
import { readFileSync } from "node:fs";
<<<<<<< Updated upstream
import process from "node:process";
=======
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
>>>>>>> Stashed changes
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

<<<<<<< Updated upstream
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
=======
const sql = readFileSync(migrationPath, "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied migration: ${migration}`);
} finally {
  await client.end();
>>>>>>> Stashed changes
}

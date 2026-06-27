import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const migration = process.argv[2] ?? "002_fix_search.sql";
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "../supabase/migrations", migration);

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const sql = readFileSync(migrationPath, "utf8");
execSync(
  `npx supabase db query --db-url ${JSON.stringify(process.env.DATABASE_URL)} -f ${JSON.stringify(migrationPath)}`,
  { stdio: "inherit" }
);

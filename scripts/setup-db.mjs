import "dotenv/config";
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

execSync(
  `npx supabase db query -f supabase/migrations/001_agent_commits.sql --db-url ${JSON.stringify(process.env.DATABASE_URL)}`,
  { stdio: "inherit" }
);

#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { getHeadSha, getRemoteRepo } from "./git.js";

const API_URL = process.env.REIN_API_URL ?? "http://localhost:3000";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const program = new Command();

program
  .name("rein")
  .description("Register agent commits alongside git commits")
  .version("0.1.0");

program
  .command("register")
  .description("Register an agent commit for the current HEAD")
  .option("--sha <sha>", "Git SHA (defaults to HEAD)")
  .option("--repo <repo>", "Repository (defaults to origin remote)")
  .option("--api <url>", "Rein API URL", API_URL)
  .action(async (opts) => {
    if (!SUPABASE_SECRET_KEY) {
      console.error(
        "Missing SUPABASE_SECRET_KEY. Set it in .env for authenticated API requests."
      );
      process.exit(1);
    }

    const gitSha = opts.sha ?? getHeadSha();
    const repo = opts.repo ?? getRemoteRepo();

    const res = await fetch(`${opts.api}/agent-commits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SECRET_KEY,
      },
      body: JSON.stringify({ git_sha: gitSha, repo }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(
        `Failed to register agent commit (${res.status}): ${err || res.statusText}`
      );
      process.exit(1);
    }

    const agentCommit = await res.json();
    console.log(JSON.stringify(agentCommit, null, 2));
  });

program.parse();

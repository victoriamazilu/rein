#!/usr/bin/env node
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { AgentCommitStore, createSupabase } from "./db.js";
import {
  createGitCommit,
  getHeadSha,
  getRecentCommits,
  getRepoId,
  getStagedDiff,
  getStatusShort,
  hasStagedChanges,
  hasUnstagedChanges,
  isInsideGitRepo,
  resolveCommitSha,
} from "./git.js";
import { addSearchEdges, buildMemoryGraph, writeGraphHtml } from "./graph.js";
import { backfillAgentCommits } from "./backfill.js";
import { distillAgentCommit, embedText } from "./llm.js";

const program = new Command();

program
  .name("agentgit")
  .description("Agent-native semantic memory on top of git commits")
  .version("0.1.0");

program
  .command("commit")
  .description("Create a git commit and store AgentCommit semantic memory")
  .option("--dry-run", "Generate and print memory without committing")
  .option("--repo <repo>", "Repository id (default: origin remote or git root path)")
  .action(async (opts: { dryRun?: boolean; repo?: string }) => {
    try {
      assertGitRepo();
      const repo = resolveRepo(opts.repo);
      if (!hasStagedChanges()) {
        console.error("No staged changes. Run `git add ...` first.");
        process.exit(1);
      }

      const status = getStatusShort();
      if (hasUnstagedChanges()) {
        console.warn("⚠ Unstaged changes detected. agentgit commit will only include staged changes.");
      }

      const recentCommits = getRecentCommits();
      const stagedDiff = getStagedDiff();

      console.log("Distilling staged changes into AgentCommit memory...");
      const distilled = await distillAgentCommit({ status, recentCommits, stagedDiff });

      if (opts.dryRun) {
        console.log(JSON.stringify(distilled, null, 2));
        return;
      }

      console.log(`Creating git commit: ${distilled.commit_message}`);
      createGitCommit(distilled.commit_message);
      const sha = getHeadSha();

      try {
        console.log("Generating embedding...");
        const embedding = await embedText(distilled.embedding_text);

        console.log("Storing AgentCommit in Supabase...");
        const store = new AgentCommitStore(createSupabase());
        const existing = await store.getBySha(sha, repo);
        const agentCommit =
          existing ??
          (await store.create({
            repo,
            sha,
            title: distilled.title,
            intent: distilled.intent,
            reasoning_trace: distilled.reasoning_trace,
            notes_for_future_agents: distilled.notes_for_future_agents,
            embedding_text: distilled.embedding_text,
            embedding,
          }));

        console.log("\n✓ AgentGit commit complete");
        console.log(`Repo: ${agentCommit.repo}`);
        console.log(`SHA: ${agentCommit.sha}`);
        if (agentCommit.title) console.log(`Title: ${agentCommit.title}`);
        console.log(`Intent: ${agentCommit.intent}`);
        console.log(`Notes: ${agentCommit.notes_for_future_agents}`);
      } catch (err) {
        writePendingAgentCommit(sha, { repo, sha, ...distilled, created_at: new Date().toISOString() });
        console.warn("\n⚠ Git commit was created, but AgentCommit storage failed.");
        console.warn(`Saved pending memory to .agentgit/pending/${sha}.json`);
        throw err;
      }
    } catch (err) {
      await handleCommitError(err);
    }
  });

program
  .command("search")
  .description("Hybrid semantic + keyword search over AgentCommit memory")
  .argument("<query...>", "Search query")
  .option("-n, --count <count>", "Number of results", "10")
  .option("--repo <repo>", "Repository id (default: origin remote or git root path)")
  .action(async (queryParts: string[], opts: { count: string; repo?: string }) => {
    const query = queryParts.join(" ");
    try {
      const count = Number.parseInt(opts.count, 10);
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error("--count must be a positive number");
      }

      const repo = resolveRepo(opts.repo);
      console.log(`Searching AgentCommit memory for ${repo}...`);
      const queryEmbedding = await embedText(query);
      const store = new AgentCommitStore(createSupabase());
      const results = await store.search(query, queryEmbedding, repo, count);

      if (results.length === 0) {
        console.log("No matching agent_commits found.");
        return;
      }

      console.log("\nRelevant agent_commits:\n");
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${shortSha(result.sha)} — ${result.intent}`);
        console.log(`   SHA: ${result.sha}`);
        console.log(`   Score: ${formatScore(result.combined_score)} | vector ${formatScore(result.vector_similarity)} | keyword ${formatScore(result.keyword_rank)}`);
        console.log(`   Notes: ${result.notes_for_future_agents}`);
        console.log("");
      });
    } catch (err) {
      printError(err);
      process.exit(1);
    }
  });

program
  .command("graph")
  .description("Generate an interactive HTML graph of AgentCommit memory connections")
  .option("-o, --output <path>", "Output HTML path", ".agentgit/memory-graph.html")
  .option("-q, --query <query>", "Highlight search results for a query (simulates agent lookup)")
  .option(
    "--threshold <similarity>",
    "Minimum cosine similarity for a thick semantic link (0–1)",
    "0.78"
  )
  .option("--repo <repo>", "Repository id (default: origin remote or git root path)")
  .action(async (opts: { output: string; query?: string; threshold: string; repo?: string }) => {
    try {
      const threshold = Number.parseFloat(opts.threshold);
      if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
        throw new Error("--threshold must be between 0 and 1");
      }

      const repo = resolveRepo(opts.repo);
      const store = new AgentCommitStore(createSupabase());
      const commits = await store.listByRepo(repo);
      if (commits.length === 0) {
        console.log(`No agent_commits found for ${repo}. Run \`agentgit commit\` first.`);
        return;
      }

      let graph = buildMemoryGraph(commits, { similarityThreshold: threshold });

      if (opts.query) {
        const queryEmbedding = await embedText(opts.query);
        const results = await store.search(opts.query, queryEmbedding, repo, 5);
        graph = addSearchEdges(
          graph,
          results.map((result) => ({ id: result.id, combined_score: result.combined_score })),
          opts.query
        );
      }

      writeGraphHtml(opts.output, graph, `AgentGit Memory Graph — ${repo}`);
      console.log(`Wrote memory graph (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
      console.log(`Open: ${opts.output}`);
      if (opts.query) {
        console.log(`Search overlay: "${opts.query}"`);
      }
    } catch (err) {
      printError(err);
      process.exit(1);
    }
  });

program
  .command("backfill")
  .description("Distill and store agent_commits for existing git history")
  .option("--from <ref>", "Start at this commit (inclusive)")
  .option("--to <ref>", "End at this commit (inclusive)", "HEAD")
  .option("-n, --max <count>", "Maximum number of commits to process")
  .option("--dry-run", "Distill and print memory without storing")
  .option("--force", "Re-process commits even if already stored")
  .option("--delay-ms <ms>", "Pause between commits (rate limiting)", "0")
  .option("--repo <repo>", "Repository id (default: origin remote or git root path)")
  .action(async (opts: {
    from?: string;
    to?: string;
    max?: string;
    dryRun?: boolean;
    force?: boolean;
    delayMs: string;
    repo?: string;
  }) => {
    try {
      assertGitRepo();
      const repo = resolveRepo(opts.repo);

      const max = opts.max ? Number.parseInt(opts.max, 10) : undefined;
      if (opts.max && (!Number.isFinite(max!) || max! <= 0)) {
        throw new Error("--max must be a positive number");
      }

      const delayMs = Number.parseInt(opts.delayMs, 10);
      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new Error("--delay-ms must be a non-negative number");
      }

      const result = await backfillAgentCommits({
        repo,
        from: opts.from,
        to: opts.to,
        max,
        dryRun: opts.dryRun,
        force: opts.force,
        delayMs: delayMs || undefined,
      });

      console.log("\nBackfill complete");
      console.log(`Total: ${result.total} | Stored: ${result.stored} | Skipped: ${result.skipped} | Failed: ${result.failed.length}`);

      if (result.failed.length > 0) {
        process.exit(1);
      }
    } catch (err) {
      printError(err);
      process.exit(1);
    }
  });

program
  .command("show")
  .description("Show AgentCommit metadata for a git commit ref")
  .argument("[ref]", "Git commit ref, SHA, or short SHA", "HEAD")
  .option("--repo <repo>", "Repository id (default: origin remote or git root path)")
  .action(async (ref: string, opts: { repo?: string }) => {
    try {
      const repo = resolveRepo(opts.repo);
      const sha = isInsideGitRepo() ? resolveCommitSha(ref) : ref;
      const store = new AgentCommitStore(createSupabase());
      const agentCommit = await store.getBySha(sha, repo);

      if (!agentCommit) {
        console.error(`No AgentCommit found for ${ref} (${sha}) in ${repo}`);
        process.exit(1);
      }

      printAgentCommit(agentCommit);
    } catch (err) {
      printError(err);
      process.exit(1);
    }
  });

program.parse();

function assertGitRepo(): void {
  if (!isInsideGitRepo()) throw new Error("Not inside a git repository");
}

function resolveRepo(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  assertGitRepo();
  return getRepoId();
}

async function handleCommitError(err: unknown): Promise<void> {
  printError(err);
  process.exit(1);
}

function printError(err: unknown): void {
  console.error(`Error: ${errorMessage(err)}`);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function printAgentCommit(agentCommit: {
  repo?: string;
  sha: string;
  title?: string | null;
  intent: string;
  reasoning_trace: string;
  notes_for_future_agents: string;
  embedding_text: string;
  created_at?: string;
}): void {
  console.log(`Commit: ${agentCommit.sha}`);
  if (agentCommit.repo) console.log(`Repo: ${agentCommit.repo}`);
  if (agentCommit.created_at) console.log(`Created: ${agentCommit.created_at}`);
  if (agentCommit.title) console.log(`Title: ${agentCommit.title}`);
  console.log("");
  console.log(`Intent:\n${agentCommit.intent}\n`);
  console.log(`Reasoning Trace:\n${agentCommit.reasoning_trace}\n`);
  console.log(`Notes for Future Agents:\n${agentCommit.notes_for_future_agents}\n`);
  console.log(`Embedding Text:\n${agentCommit.embedding_text}`);
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(4) : String(score);
}

export function writePendingAgentCommit(sha: string, value: unknown): void {
  const dir = join(process.cwd(), ".agentgit", "pending");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sha}.json`), JSON.stringify(value, null, 2));
}

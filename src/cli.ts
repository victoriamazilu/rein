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
  getStagedDiff,
  getStatusShort,
  hasStagedChanges,
  hasUnstagedChanges,
  isInsideGitRepo,
  resolveCommitSha,
} from "./git.js";
import { addSearchEdges, buildMemoryGraph, writeGraphHtml } from "./graph.js";
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
  .action(async (opts: { dryRun?: boolean }) => {
    try {
      assertGitRepo();
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
        const existing = await store.getBySha(sha);
        const agentCommit =
          existing ??
          (await store.create({
            sha,
            intent: distilled.intent,
            reasoning_trace: distilled.reasoning_trace,
            notes_for_future_agents: distilled.notes_for_future_agents,
            embedding_text: distilled.embedding_text,
            embedding,
          }));

        console.log("\n✓ AgentGit commit complete");
        console.log(`SHA: ${agentCommit.sha}`);
        console.log(`Intent: ${agentCommit.intent}`);
        console.log(`Notes: ${agentCommit.notes_for_future_agents}`);
      } catch (err) {
        writePendingAgentCommit(sha, { sha, ...distilled, created_at: new Date().toISOString() });
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
  .action(async (queryParts: string[], opts: { count: string }) => {
    const query = queryParts.join(" ");
    try {
      const count = Number.parseInt(opts.count, 10);
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error("--count must be a positive number");
      }

      console.log("Searching AgentCommit memory...");
      const queryEmbedding = await embedText(query);
      const store = new AgentCommitStore(createSupabase());
      const results = await store.search(query, queryEmbedding, count);

      if (results.length === 0) {
        console.log("No matching AgentCommits found.");
        return;
      }

      console.log("\nRelevant AgentCommits:\n");
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
    "0.85"
  )
  .action(async (opts: { output: string; query?: string; threshold: string }) => {
    try {
      const threshold = Number.parseFloat(opts.threshold);
      if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
        throw new Error("--threshold must be between 0 and 1");
      }

      const store = new AgentCommitStore(createSupabase());
      const commits = await store.listAll();
      if (commits.length === 0) {
        console.log("No AgentCommits found. Run `agentgit commit` first.");
        return;
      }

      let graph = buildMemoryGraph(commits, { similarityThreshold: threshold });

      if (opts.query) {
        const queryEmbedding = await embedText(opts.query);
        const results = await store.search(opts.query, queryEmbedding, 5);
        graph = addSearchEdges(
          graph,
          results.map((result) => ({ id: result.id, combined_score: result.combined_score }))
        );
      }

      writeGraphHtml(opts.output, graph, "AgentGit Memory Graph");
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
  .command("show")
  .description("Show AgentCommit metadata for a git commit ref")
  .argument("[ref]", "Git commit ref, SHA, or short SHA", "HEAD")
  .action(async (ref: string) => {
    try {
      const sha = isInsideGitRepo() ? resolveCommitSha(ref) : ref;
      const store = new AgentCommitStore(createSupabase());
      const agentCommit = await store.getBySha(sha);

      if (!agentCommit) {
        console.error(`No AgentCommit found for ${ref} (${sha})`);
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
  sha: string;
  intent: string;
  reasoning_trace: string;
  notes_for_future_agents: string;
  embedding_text: string;
  created_at?: string;
}): void {
  console.log(`Commit: ${agentCommit.sha}`);
  if (agentCommit.created_at) console.log(`Created: ${agentCommit.created_at}`);
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

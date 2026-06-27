import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const datasetPath = process.argv[2] ?? "benchmarks/agentgit-search.json";
const outputPath = process.argv[3] ?? "benchmarks/latest-report.md";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "how",
  "what",
  "why",
  "when",
  "where",
  "does",
  "did",
  "was",
  "were",
  "can",
  "could",
  "should",
  "into",
  "after",
  "before",
]);

const dataset = JSON.parse(readFileSync(datasetPath, "utf-8"));
const k = Number(dataset.k ?? 5);

const requiredEnv = ["OPENAI_API_KEY", "SUPABASE_URL"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Add it to .env before running the benchmark.`);
    process.exit(1);
  }
}

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_ANON_KEY.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const embeddingModel = process.env.AGENTGIT_EMBEDDING_MODEL ?? "text-embedding-3-small";

const gitCommits = readGitCommits();
const rows = [];

for (const item of dataset.queries) {
  const relevant = item.relevant.map((sha) => sha.toLowerCase());

  const agentGitStarted = performance.now();
  const agentGitResults = await runAgentGitSearch(item.query, k);
  const agentGitMs = performance.now() - agentGitStarted;

  const gitGrepStarted = performance.now();
  const gitGrepResults = runGitGrepBaseline(item.query, k);
  const gitGrepMs = performance.now() - gitGrepStarted;

  const gitStarted = performance.now();
  const gitKeywordResults = runGitKeywordBaseline(item.query, k);
  const gitMs = performance.now() - gitStarted;

  rows.push({
    query: item.query,
    why: item.why ?? "",
    relevant,
    agentGitResults,
    gitGrepResults,
    gitKeywordResults,
    agentGitRank: firstRelevantRank(agentGitResults, relevant),
    gitGrepRank: firstRelevantRank(gitGrepResults, relevant),
    gitKeywordRank: firstRelevantRank(gitKeywordResults, relevant),
    agentGitMs,
    gitGrepMs,
    gitKeywordMs: gitMs,
  });
}

const report = renderReport(dataset, rows, k);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, report, "utf-8");

console.log(report);
console.log(`\nWrote ${outputPath}`);

async function runAgentGitSearch(query, matchCount) {
  const embeddingResponse = await openai.embeddings.create({
    model: embeddingModel,
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const { data, error } = await supabase.rpc("match_agent_commits", {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    sha: row.sha,
    title: row.intent,
    score: Number(row.combined_score ?? 0),
  }));
}

function runGitKeywordBaseline(query, matchCount) {
  const queryTokens = tokenize(query);
  return gitCommits
    .map((commit) => ({
      ...commit,
      score: keywordScore(queryTokens, tokenize(`${commit.subject} ${commit.body}`)),
    }))
    .filter((commit) => commit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, matchCount)
    .map((commit) => ({
      sha: commit.sha,
      title: commit.subject,
      score: commit.score,
    }));
}

function runGitGrepBaseline(query, matchCount) {
  try {
    const output = execFileSync(
      "git",
      [
        "log",
        "--all",
        "--regexp-ignore-case",
        "--grep",
        query,
        `--max-count=${matchCount}`,
        "--format=%H%x1f%s%x1e",
      ],
      { encoding: "utf-8" }
    );

    return output
      .split("\x1e")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [sha, title = ""] = entry.split("\x1f");
        return { sha, title, score: 1 };
      });
  } catch {
    return [];
  }
}

function readGitCommits() {
  const output = execFileSync(
    "git",
    ["log", "--all", "--format=%H%x1f%s%x1f%b%x1e"],
    { encoding: "utf-8" }
  );

  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, subject = "", body = ""] = entry.split("\x1f");
      return { sha, subject, body };
    });
}

function tokenize(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 3)
      .filter((token) => !STOP_WORDS.has(token))
  );
}

function keywordScore(queryTokens, docTokens) {
  let overlap = 0;
  for (const token of queryTokens) {
    if (docTokens.has(token)) overlap += 1;
  }
  return queryTokens.size === 0 ? 0 : overlap / queryTokens.size;
}

function firstRelevantRank(results, relevantPrefixes) {
  const index = results.findIndex((result) => isRelevant(result.sha, relevantPrefixes));
  return index === -1 ? null : index + 1;
}

function isRelevant(sha, relevantPrefixes) {
  const normalized = sha.toLowerCase();
  return relevantPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function recallAt(rows, system, limit) {
  const hits = rows.filter((row) => {
    const results = getSystemResults(row, system);
    return results.slice(0, limit).some((result) => isRelevant(result.sha, row.relevant));
  }).length;
  return hits / rows.length;
}

function meanReciprocalRank(rows, system) {
  const total = rows.reduce((sum, row) => {
    const rank = getSystemRank(row, system);
    return sum + (rank ? 1 / rank : 0);
  }, 0);
  return total / rows.length;
}

function averageRank(rows, system) {
  const ranks = rows
    .map((row) => getSystemRank(row, system))
    .filter((rank) => rank !== null);
  if (ranks.length === 0) return null;
  return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
}

function averageMs(rows, system) {
  const total = rows.reduce(
    (sum, row) => sum + getSystemMs(row, system),
    0
  );
  return total / rows.length;
}

function getSystemResults(row, system) {
  if (system === "agentgit") return row.agentGitResults;
  if (system === "gitGrep") return row.gitGrepResults;
  if (system === "gitKeyword") return row.gitKeywordResults;
  throw new Error(`Unknown system: ${system}`);
}

function getSystemRank(row, system) {
  if (system === "agentgit") return row.agentGitRank;
  if (system === "gitGrep") return row.gitGrepRank;
  if (system === "gitKeyword") return row.gitKeywordRank;
  throw new Error(`Unknown system: ${system}`);
}

function getSystemMs(row, system) {
  if (system === "agentgit") return row.agentGitMs;
  if (system === "gitGrep") return row.gitGrepMs;
  if (system === "gitKeyword") return row.gitKeywordMs;
  throw new Error(`Unknown system: ${system}`);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatRank(value) {
  return value === null ? "miss" : String(value);
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

function shortSha(sha) {
  return sha.slice(0, 7);
}

function renderReport(dataset, benchmarkRows, matchCount) {
  const now = new Date().toISOString();
  const agentAvgRank = averageRank(benchmarkRows, "agentgit");
  const gitGrepAvgRank = averageRank(benchmarkRows, "gitGrep");
  const gitKeywordAvgRank = averageRank(benchmarkRows, "gitKeyword");

  const lines = [
    `# ${dataset.name}`,
    "",
    `Generated: ${now}`,
    "",
    dataset.description ?? "",
    "",
    "## What This Measures",
    "",
    "This benchmark asks beginner-style project questions and checks whether each system finds the commit that contains the useful answer.",
    "",
    "- AgentGit = semantic memory search over AgentCommit notes.",
    "- Plain Git = real `git log --grep` search over normal commit messages.",
    "- Keyword sanity check = a stronger custom keyword search over normal commit messages.",
    "",
    "## Headline Results",
    "",
    "| Metric | AgentGit | Plain Git `log --grep` | Keyword sanity check |",
    "| --- | ---: | ---: | ---: |",
    `| Right answer in top 1 | ${formatPercent(recallAt(benchmarkRows, "agentgit", 1))} | ${formatPercent(recallAt(benchmarkRows, "gitGrep", 1))} | ${formatPercent(recallAt(benchmarkRows, "gitKeyword", 1))} |`,
    `| Right answer in top 3 | ${formatPercent(recallAt(benchmarkRows, "agentgit", 3))} | ${formatPercent(recallAt(benchmarkRows, "gitGrep", 3))} | ${formatPercent(recallAt(benchmarkRows, "gitKeyword", 3))} |`,
    `| Right answer in top ${matchCount} | ${formatPercent(recallAt(benchmarkRows, "agentgit", matchCount))} | ${formatPercent(recallAt(benchmarkRows, "gitGrep", matchCount))} | ${formatPercent(recallAt(benchmarkRows, "gitKeyword", matchCount))} |`,
    `| Mean reciprocal rank | ${formatNumber(meanReciprocalRank(benchmarkRows, "agentgit"))} | ${formatNumber(meanReciprocalRank(benchmarkRows, "gitGrep"))} | ${formatNumber(meanReciprocalRank(benchmarkRows, "gitKeyword"))} |`,
    `| Average winning rank | ${formatNumber(agentAvgRank)} | ${formatNumber(gitGrepAvgRank)} | ${formatNumber(gitKeywordAvgRank)} |`,
    `| Average query time | ${formatNumber(averageMs(benchmarkRows, "agentgit"))} ms | ${formatNumber(averageMs(benchmarkRows, "gitGrep"))} ms | ${formatNumber(averageMs(benchmarkRows, "gitKeyword"))} ms |`,
    "",
    "## Query-Level Results",
    "",
    "| Question | Expected commit | AgentGit rank | Plain Git rank | Keyword rank | AgentGit top result | Plain Git top result |",
    "| --- | --- | ---: | ---: | ---: | --- | --- |",
  ];

  for (const row of benchmarkRows) {
    const agentTop = row.agentGitResults[0]
      ? `${shortSha(row.agentGitResults[0].sha)} ${escapePipes(row.agentGitResults[0].title)}`
      : "no result";
    const gitTop = row.gitGrepResults[0]
      ? `${shortSha(row.gitGrepResults[0].sha)} ${escapePipes(row.gitGrepResults[0].title)}`
      : "no result";
    lines.push(
      `| ${escapePipes(row.query)} | ${row.relevant.join(", ")} | ${formatRank(row.agentGitRank)} | ${formatRank(row.gitGrepRank)} | ${formatRank(row.gitKeywordRank)} | ${agentTop} | ${gitTop} |`
    );
  }

  lines.push(
    "",
    "## How To Explain This",
    "",
    "A higher top-1/top-3 score means the tool finds the useful answer sooner. Mean reciprocal rank rewards systems that put the right answer near the top. Query time shows the speed tradeoff.",
    "",
    "The main proof point is AgentGit versus plain Git search. The keyword sanity check is included to show whether plain commit messages are already good enough for a question.",
    ""
  );

  return lines.filter((line) => line !== undefined).join("\n");
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, basename } from "node:path";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const { datasetPath, outputPath, repo } = parseArgs(process.argv.slice(2));

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
  const agentGitResults = await runAgentGitSearch(item.query, k, repo);
  const agentGitMs = performance.now() - agentGitStarted;

  const gitGrepStarted = performance.now();
  const gitGrepResults = runGitExactGrepBaseline(item.query, k);
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

const summary = buildSummary(rows, k);
const report = renderReport(dataset, rows, summary, k, repo);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, report, "utf-8");
writeFileSync(jsonReportPath(outputPath), JSON.stringify({ repo, k, summary, rows }, null, 2), "utf-8");

console.log(report);
console.log(`\nWrote ${outputPath}`);
console.log(`Wrote ${jsonReportPath(outputPath)}`);

function parseArgs(args) {
  const positional = [];
  let explicitRepo;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--repo") {
      explicitRepo = args[++i];
    } else if (arg.startsWith("--repo=")) {
      explicitRepo = arg.slice("--repo=".length);
    } else {
      positional.push(arg);
    }
  }

  return {
    datasetPath: positional[0] ?? "benchmarks/agentgit-search.json",
    outputPath: positional[1] ?? "benchmarks/latest-report.md",
    repo: explicitRepo ?? process.env.AGENTGIT_REPO ?? inferRepoId(),
  };
}

function inferRepoId() {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf-8" }).trim();
    const sshMatch = url.match(/git@github\.com:(.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];

    const httpsMatch = url.match(/github\.com\/(.+?)(?:\.git)?$/);
    if (httpsMatch) return httpsMatch[1];

    return url;
  } catch {
    return basename(process.cwd());
  }
}

function jsonReportPath(markdownPath) {
  return markdownPath.endsWith(".md")
    ? `${markdownPath.slice(0, -3)}.json`
    : `${markdownPath}.json`;
}

async function runAgentGitSearch(query, matchCount, filterRepo) {
  const embeddingResponse = await openai.embeddings.create({
    model: embeddingModel,
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const { data, error } = await supabase.rpc("match_agent_commits", {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: matchCount,
    filter_repo: filterRepo,
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

function runGitExactGrepBaseline(query, matchCount) {
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

function precisionAt(rows, system, limit) {
  const total = rows.reduce((sum, row) => {
    const results = getSystemResults(row, system).slice(0, limit);
    if (results.length === 0) return sum;
    const relevantCount = results.filter((result) => isRelevant(result.sha, row.relevant)).length;
    return sum + relevantCount / limit;
  }, 0);
  return total / rows.length;
}

function meanReciprocalRank(rows, system) {
  const total = rows.reduce((sum, row) => {
    const rank = getSystemRank(row, system);
    return sum + (rank ? 1 / rank : 0);
  }, 0);
  return total / rows.length;
}

function ndcgAt(rows, system, limit) {
  const total = rows.reduce((sum, row) => {
    const results = getSystemResults(row, system).slice(0, limit);
    const dcg = results.reduce((score, result, index) => {
      const gain = isRelevant(result.sha, row.relevant) ? 1 : 0;
      return score + gain / Math.log2(index + 2);
    }, 0);

    const idealRelevant = Math.min(row.relevant.length, limit);
    const idcg = Array.from({ length: idealRelevant }).reduce(
      (score, _, index) => score + 1 / Math.log2(index + 2),
      0
    );

    return sum + (idcg === 0 ? 0 : dcg / idcg);
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

function queriesWon(rows, systemA, systemB) {
  return rows.filter((row) => compareRanks(getSystemRank(row, systemA), getSystemRank(row, systemB)) < 0).length;
}

function queriesTied(rows, systemA, systemB) {
  return rows.filter((row) => compareRanks(getSystemRank(row, systemA), getSystemRank(row, systemB)) === 0).length;
}

function compareRanks(a, b) {
  const normalizedA = a ?? Number.POSITIVE_INFINITY;
  const normalizedB = b ?? Number.POSITIVE_INFINITY;
  return normalizedA - normalizedB;
}

function percentagePointLift(rows, systemA, systemB, limit) {
  return recallAt(rows, systemA, limit) - recallAt(rows, systemB, limit);
}

function reciprocalRankLift(rows, systemA, systemB) {
  return meanReciprocalRank(rows, systemA) - meanReciprocalRank(rows, systemB);
}

function buildSummary(benchmarkRows, matchCount) {
  return {
    queryCount: benchmarkRows.length,
    systems: {
      agentgit: systemSummary(benchmarkRows, "agentgit", matchCount),
      gitGrep: systemSummary(benchmarkRows, "gitGrep", matchCount),
      gitKeyword: systemSummary(benchmarkRows, "gitKeyword", matchCount),
    },
    liftVsPlainGit: {
      top1: percentagePointLift(benchmarkRows, "agentgit", "gitGrep", 1),
      top3: percentagePointLift(benchmarkRows, "agentgit", "gitGrep", 3),
      topK: percentagePointLift(benchmarkRows, "agentgit", "gitGrep", matchCount),
      mrr: reciprocalRankLift(benchmarkRows, "agentgit", "gitGrep"),
      wins: queriesWon(benchmarkRows, "agentgit", "gitGrep"),
      ties: queriesTied(benchmarkRows, "agentgit", "gitGrep"),
    },
    liftVsKeyword: {
      top1: percentagePointLift(benchmarkRows, "agentgit", "gitKeyword", 1),
      top3: percentagePointLift(benchmarkRows, "agentgit", "gitKeyword", 3),
      topK: percentagePointLift(benchmarkRows, "agentgit", "gitKeyword", matchCount),
      mrr: reciprocalRankLift(benchmarkRows, "agentgit", "gitKeyword"),
      wins: queriesWon(benchmarkRows, "agentgit", "gitKeyword"),
      ties: queriesTied(benchmarkRows, "agentgit", "gitKeyword"),
    },
  };
}

function systemSummary(benchmarkRows, system, matchCount) {
  return {
    precisionAt1: precisionAt(benchmarkRows, system, 1),
    precisionAt3: precisionAt(benchmarkRows, system, 3),
    top1: recallAt(benchmarkRows, system, 1),
    top3: recallAt(benchmarkRows, system, 3),
    topK: recallAt(benchmarkRows, system, matchCount),
    mrr: meanReciprocalRank(benchmarkRows, system),
    ndcgAtK: ndcgAt(benchmarkRows, system, matchCount),
    averageWinningRank: averageRank(benchmarkRows, system),
    averageMs: averageMs(benchmarkRows, system),
  };
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

function formatSignedPercent(value) {
  const rounded = Math.round(value * 100);
  return `${rounded >= 0 ? "+" : ""}${rounded} points`;
}

function formatSignedNumber(value) {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
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

function renderReport(dataset, benchmarkRows, summary, matchCount, repoId) {
  const now = new Date().toISOString();
  const agent = summary.systems.agentgit;
  const gitGrep = summary.systems.gitGrep;
  const gitKeyword = summary.systems.gitKeyword;

  const lines = [
    `# ${dataset.name}`,
    "",
    `Generated: ${now}`,
    `Repo: ${repoId}`,
    `Questions: ${summary.queryCount}`,
    "",
    dataset.description ?? "",
    "",
    "## Executive Summary",
    "",
    `AgentGit found the right commit in the top 3 for ${formatPercent(agent.top3)} of questions. Exact grep found ${formatPercent(gitGrep.top3)}. The stronger keyword sanity check found ${formatPercent(gitKeyword.top3)}.`,
    "",
    `Compared with the stronger keyword baseline, AgentGit improves top-3 accuracy by ${formatSignedPercent(summary.liftVsKeyword.top3)} and mean reciprocal rank by ${formatSignedNumber(summary.liftVsKeyword.mrr)}.`,
    "",
    `AgentGit beat exact grep on ${summary.liftVsPlainGit.wins}/${summary.queryCount} questions and beat the stronger keyword baseline on ${summary.liftVsKeyword.wins}/${summary.queryCount} questions.`,
    "",
    "## What This Measures",
    "",
    "This benchmark asks project-history questions and checks whether each system finds the commit that contains the useful answer.",
    "",
    "- AgentGit = semantic memory search over AgentCommit notes. It can match meaning even when the exact words differ.",
    "- Exact grep = real `git log --grep` over normal commit messages. It only finds the exact query text.",
    "- Keyword sanity check = a stronger custom token-overlap search over normal commit messages. It is closer to search than raw grep, but still cannot understand meaning.",
    "",
    "This split matters because the product claim is not merely that AgentGit is another text search box. The claim is that semantic memory answers vague project-history questions that grep-style exact matching misses.",
    "",
    "## Headline Results",
    "",
    "| Metric | AgentGit | Exact grep `git log --grep` | Keyword sanity check |",
    "| --- | ---: | ---: | ---: |",
    `| Precision@1 | ${formatPercent(agent.precisionAt1)} | ${formatPercent(gitGrep.precisionAt1)} | ${formatPercent(gitKeyword.precisionAt1)} |`,
    `| Precision@3 | ${formatPercent(agent.precisionAt3)} | ${formatPercent(gitGrep.precisionAt3)} | ${formatPercent(gitKeyword.precisionAt3)} |`,
    `| Right answer in top 1 | ${formatPercent(agent.top1)} | ${formatPercent(gitGrep.top1)} | ${formatPercent(gitKeyword.top1)} |`,
    `| Right answer in top 3 | ${formatPercent(agent.top3)} | ${formatPercent(gitGrep.top3)} | ${formatPercent(gitKeyword.top3)} |`,
    `| Right answer in top ${matchCount} | ${formatPercent(agent.topK)} | ${formatPercent(gitGrep.topK)} | ${formatPercent(gitKeyword.topK)} |`,
    `| Mean reciprocal rank | ${formatNumber(agent.mrr)} | ${formatNumber(gitGrep.mrr)} | ${formatNumber(gitKeyword.mrr)} |`,
    `| nDCG@${matchCount} | ${formatNumber(agent.ndcgAtK)} | ${formatNumber(gitGrep.ndcgAtK)} | ${formatNumber(gitKeyword.ndcgAtK)} |`,
    `| Average winning rank | ${formatNumber(agent.averageWinningRank)} | ${formatNumber(gitGrep.averageWinningRank)} | ${formatNumber(gitKeyword.averageWinningRank)} |`,
    `| Average query time | ${formatNumber(agent.averageMs)} ms | ${formatNumber(gitGrep.averageMs)} ms | ${formatNumber(gitKeyword.averageMs)} ms |`,
    "",
    "## Lift",
    "",
    "| Comparison | Top 1 lift | Top 3 lift | Top 5 lift | MRR lift | Wins | Ties |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| AgentGit vs exact grep | ${formatSignedPercent(summary.liftVsPlainGit.top1)} | ${formatSignedPercent(summary.liftVsPlainGit.top3)} | ${formatSignedPercent(summary.liftVsPlainGit.topK)} | ${formatSignedNumber(summary.liftVsPlainGit.mrr)} | ${summary.liftVsPlainGit.wins}/${summary.queryCount} | ${summary.liftVsPlainGit.ties}/${summary.queryCount} |`,
    `| AgentGit vs keyword sanity check | ${formatSignedPercent(summary.liftVsKeyword.top1)} | ${formatSignedPercent(summary.liftVsKeyword.top3)} | ${formatSignedPercent(summary.liftVsKeyword.topK)} | ${formatSignedNumber(summary.liftVsKeyword.mrr)} | ${summary.liftVsKeyword.wins}/${summary.queryCount} | ${summary.liftVsKeyword.ties}/${summary.queryCount} |`,
    "",
    "## Query-Level Results",
    "",
    "| Question | Why it matters | Expected commit | AgentGit rank | Exact grep rank | Keyword rank | AgentGit top result | Keyword top result |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
  ];

  for (const row of benchmarkRows) {
    const agentTop = row.agentGitResults[0]
      ? `${shortSha(row.agentGitResults[0].sha)} ${escapePipes(row.agentGitResults[0].title)}`
      : "no result";
    const gitTop = row.gitGrepResults[0]
      ? `${shortSha(row.gitGrepResults[0].sha)} ${escapePipes(row.gitGrepResults[0].title)}`
      : "no result";
    const keywordTop = row.gitKeywordResults[0]
      ? `${shortSha(row.gitKeywordResults[0].sha)} ${escapePipes(row.gitKeywordResults[0].title)}`
      : "no result";
    lines.push(
      `| ${escapePipes(row.query)} | ${escapePipes(row.why)} | ${row.relevant.join(", ")} | ${formatRank(row.agentGitRank)} | ${formatRank(row.gitGrepRank)} | ${formatRank(row.gitKeywordRank)} | ${agentTop} | ${keywordTop} |`
    );
  }

  lines.push(
    "",
    "## How To Explain This",
    "",
    "A higher top-1/top-3 score means the tool finds the useful answer sooner. Mean reciprocal rank rewards systems that put the right answer near the top. Query time shows the speed tradeoff.",
    "",
    "The main proof point is AgentGit versus exact grep because grep is the default mental model many developers have for searching old text. The keyword sanity check keeps the benchmark honest by testing whether normal commit messages are already enough when exact phrase matching is relaxed.",
    "",
    "A good demo line is: grep requires the user to guess the words already used in history; AgentGit lets the user ask the question in their own words.",
    ""
  );

  return lines.filter((line) => line !== undefined).join("\n");
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

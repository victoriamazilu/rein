import { writeFileSync } from "node:fs";

const OUTPUT = "data/local-repository-db.json";
const BASE_TIME = Date.parse("2026-06-26T16:00:00.000Z");
const DAY = 86_400_000;
const DEFAULT_MAX_COMMITS = 90;
const MIN_COMMITS = 75;
const MAX_COMMITS = 100;
const requestedMaxCommits = Number.parseInt(process.env.LOCAL_SEED_MAX_COMMITS ?? "", 10);
const maxCommitsPerRepo = Number.isFinite(requestedMaxCommits)
  ? Math.min(MAX_COMMITS, Math.max(MIN_COMMITS, requestedMaxCommits))
  : DEFAULT_MAX_COMMITS;

const topics = [
  {
    key: "workspace",
    label: "Workspace analytics",
    vector: [0.92, 0.05, 0.05, 0.02, 0.42, 0.25, 0.05, 0.55],
    modules: ["workspace", "dashboard", "analytics"],
    files: ["components/WorkspaceProvider.tsx", "components/HomeView.tsx", "lib/workspace.ts"],
  },
  {
    key: "evaluation",
    label: "Evaluation pipeline",
    vector: [0.08, 0.96, 0.03, 0.02, 0.34, 0.42, 0.08, 0.18],
    modules: ["evals", "prompts", "datasets"],
    files: ["src/evals/runner.py", "src/evals/rubrics.py", "datasets/regressions.json"],
  },
  {
    key: "release",
    label: "Release operations",
    vector: [0.06, 0.04, 0.96, 0.28, 0.2, 0.22, 0.58, 0.18],
    modules: ["release", "deployments", "incidents"],
    files: ["src/releases/timeline.go", "src/incidents/service_map.go", ".github/workflows/release.yml"],
  },
  {
    key: "policy",
    label: "Policy controls",
    vector: [0.04, 0.02, 0.62, 0.96, 0.18, 0.14, 0.7, 0.22],
    modules: ["policy", "approval", "audit"],
    files: ["crates/policy/src/rules.rs", "crates/audit/src/events.rs", "docs/release-policy.md"],
  },
  {
    key: "search",
    label: "Semantic search",
    vector: [0.45, 0.1, 0.02, 0.02, 0.95, 0.2, 0.04, 0.2],
    modules: ["search", "embeddings", "ranking"],
    files: ["src/search/rank.ts", "src/embeddings/index.ts", "benchmarks/search.json"],
  },
  {
    key: "fixtures",
    label: "Local fixtures",
    vector: [0.16, 0.74, 0.03, 0.03, 0.28, 0.94, 0.1, 0.16],
    modules: ["fixtures", "seed", "local-db"],
    files: ["data/local-repository-db.json", "scripts/generate-local-db.mjs", "lib/localRepositoryDb.ts"],
  },
  {
    key: "traceability",
    label: "Traceability",
    vector: [0.12, 0.18, 0.52, 0.5, 0.24, 0.86, 0.82, 0.14],
    modules: ["audit", "provenance", "history"],
    files: ["src/audit/export.ts", "src/provenance/links.ts", "docs/traceability.md"],
  },
  {
    key: "interface",
    label: "Interface workflow",
    vector: [0.7, 0.06, 0.04, 0.03, 0.68, 0.46, 0.18, 0.88],
    modules: ["ui", "filters", "graph"],
    files: ["components/RepoView.tsx", "components/CommitMemoryList.tsx", "app/globals.css"],
  },
];

const categories = [
  "feature",
  "bug fix",
  "refactor",
  "docs",
  "tests",
  "infrastructure",
  "performance",
  "security",
  "release",
  "hotfix",
];

const repos = [
  {
    org: "acme-ai",
    name: "insight-studio",
    url: "https://github.com/acme-ai/insight-studio.git",
    language: "TypeScript",
    defaultBranch: "main",
    description:
      "Workspace analytics whose Semantic Embedding Commit Graph links scorecards, memory coverage, search weighting, filters, and onboarding as related product decisions. AgentGit can navigate those concept clusters by intent, so a query about repository health or backfill reaches connected changes even when the commit text differs; GrepGit would only return direct keyword matches.",
    commitCount: 460,
    startDaysAgo: 920,
    topicWeights: { workspace: 0.32, interface: 0.22, search: 0.16, fixtures: 0.12, traceability: 0.1, release: 0.08 },
    authors: ["Mira Patel", "Theo Martin", "Nadia Kim", "Owen Brooks", "Sam Rivera", "Elena Torres"],
  },
  {
    org: "acme-ai",
    name: "eval-runner",
    url: "https://github.com/acme-ai/eval-runner.git",
    language: "Python",
    defaultBranch: "main",
    description:
      "Batch evaluation service whose commit graph connects rubric calibration, prompt traces, dataset freshness, parallel workers, and regression fixtures as one evaluation pipeline. AgentGit uses embedding relationships to retrieve conceptually similar changes across scoring, evidence, and fixture export; GrepGit would require the developer to guess exact terms such as rubric, trace, or regression.",
    commitCount: 380,
    startDaysAgo: 780,
    topicWeights: { evaluation: 0.42, fixtures: 0.22, search: 0.14, traceability: 0.1, workspace: 0.06, interface: 0.06 },
    authors: ["Nadia Kim", "Sam Rivera", "Mira Patel", "Ilya Novak", "Owen Brooks"],
  },
  {
    org: "northstar-labs",
    name: "backboard",
    url: "https://github.com/northstar-labs/backboard.git",
    language: "Go",
    defaultBranch: "main",
    description:
      "Release-readiness dashboard whose Semantic Embedding Commit Graph ties deployment risk, incident grouping, release decision backfill, service cards, stale statuses, and audit export into a traceable operational history. AgentGit follows those semantic links to explain why a release view changed and which commits share intent; GrepGit can find matching words but not the cross-commit release workflow.",
    commitCount: 430,
    startDaysAgo: 860,
    topicWeights: { release: 0.36, traceability: 0.2, workspace: 0.12, interface: 0.12, policy: 0.1, fixtures: 0.1 },
    authors: ["Iris Chen", "Marcus Lee", "Priya Singh", "Jon Bell", "Amara Okafor"],
  },
  {
    org: "northstar-labs",
    name: "release-gate",
    url: "https://github.com/northstar-labs/release-gate.git",
    language: "Rust",
    defaultBranch: "main",
    description:
      "Release policy service whose graph connects exception queues, regional deployment windows, approval rationale, and dry-run blocking as related control-plane decisions. AgentGit retrieves these architecture and compliance relationships by meaning, which helps agents reason over release intent and traceability; GrepGit would surface only files or commits containing the same policy words.",
    commitCount: 340,
    startDaysAgo: 700,
    topicWeights: { policy: 0.44, release: 0.24, traceability: 0.18, search: 0.06, fixtures: 0.05, interface: 0.03 },
    authors: ["Priya Singh", "Marcus Lee", "Iris Chen", "Noah Reed", "Lena Ortiz"],
  },
  {
    org: "victoriamazilu",
    name: "rein",
    url: "https://github.com/victoriamazilu/rein.git",
    language: "TypeScript",
    defaultBranch: "main",
    description:
      "Agent-native memory layer whose own Semantic Embedding Commit Graph links project foundation, local data access, backfill UI, memory graph visualization, and hybrid search evolution. AgentGit makes repository history navigable by architecture and intent, surfacing related graph nodes for vague questions about memory or search; GrepGit remains limited to literal text matches in commits and files.",
    commitCount: 320,
    startDaysAgo: 640,
    topicWeights: { search: 0.28, fixtures: 0.22, interface: 0.18, workspace: 0.14, traceability: 0.1, evaluation: 0.08 },
    authors: ["Victoria Mazilu", "Alex Morgan", "Nadia Kim", "Owen Brooks"],
  },
];

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickWeighted(random, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = random() * total;
  for (const [key, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function sha(repoKey, index, branch, category) {
  const random = mulberry32(hashSeed(`${repoKey}:${index}:${branch}:${category}`));
  let out = "";
  for (let i = 0; i < 40; i++) out += Math.floor(random() * 16).toString(16);
  return out;
}

function jitteredEmbedding(random, topicKey, category) {
  const topic = topics.find((item) => item.key === topicKey) ?? topics[0];
  const categoryBoosts = {
    "bug fix": [0, 0, 0, 0, 0.03, 0, 0.08, 0],
    refactor: [0, 0, 0, 0, 0.08, 0.05, 0, 0.02],
    docs: [0, 0, 0, 0, 0, 0.04, 0.05, 0],
    tests: [0, 0.08, 0, 0, 0, 0.05, 0, 0],
    infrastructure: [0, 0, 0.06, 0.02, 0, 0.04, 0, 0],
    security: [0, 0, 0.02, 0.1, 0, 0, 0.08, 0],
    release: [0, 0, 0.12, 0.04, 0, 0.02, 0.08, 0],
    hotfix: [0, 0, 0.1, 0.04, 0.02, 0, 0.1, 0],
  };
  const boost = categoryBoosts[category] ?? [];
  return topic.vector.map((value, index) =>
    Number(Math.max(0.01, Math.min(0.99, value + (boost[index] ?? 0) + (random() - 0.5) * 0.08)).toFixed(4))
  );
}

function makeMessage(category, topic) {
  const verbs = {
    feature: ["Add", "Introduce", "Build"],
    "bug fix": ["Fix", "Correct", "Repair"],
    refactor: ["Refactor", "Simplify", "Restructure"],
    docs: ["Document", "Clarify", "Update docs for"],
    tests: ["Test", "Add coverage for", "Validate"],
    infrastructure: ["Automate", "Configure", "Harden"],
    performance: ["Optimize", "Speed up", "Reduce latency in"],
    security: ["Harden", "Validate", "Lock down"],
    release: ["Prepare", "Tag", "Publish"],
    hotfix: ["Hotfix", "Patch", "Stabilize"],
  };
  return `${pick(mulberry32(hashSeed(`${category}:${topic.key}`)), verbs[category] ?? ["Update"])} ${topic.label.toLowerCase()}`;
}

function buildRepo(repo) {
  const random = mulberry32(hashSeed(`${repo.org}/${repo.name}`));
  const repoId = `${repo.org}/${repo.name}`;
  const commitCount = Math.min(repo.commitCount, maxCommitsPerRepo);
  const commits = [];
  const agentCommits = [];
  const contributors = repo.authors.map((name, index) => ({
    id: `${repo.name}-contributor-${index + 1}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`,
    commits: 0,
    ownership: [],
  }));
  const branches = [
    { name: "main", head: "", base: null, merged: false },
    { name: "develop", head: "", base: "main", merged: false },
    { name: "release/2026.06", head: "", base: "main", merged: true },
    { name: "hotfix/incident-review", head: "", base: "main", merged: true },
  ];
  const pullRequests = [];
  const issues = [];
  const releases = [];
  const tags = [];
  const files = new Map();
  const moduleOwners = new Map();
  const branchTips = new Map([["main", null], ["develop", null], ["release/2026.06", null], ["hotfix/incident-review", null]]);
  const featureBranches = ["main", "develop", "feature/semantic-graph", "feature/local-data", "feature/agent-insights", "release/2026.06", "hotfix/incident-review"];

  for (let index = 0; index < commitCount; index++) {
    const topicKey = pickWeighted(random, repo.topicWeights);
    const topic = topics.find((item) => item.key === topicKey) ?? topics[0];
    const category = index % 47 === 0 ? "release" : index % 61 === 0 ? "hotfix" : pick(random, categories.slice(0, 8));
    const branch = index % 61 === 0 ? "hotfix/incident-review" : index % 47 === 0 ? "release/2026.06" : pick(random, featureBranches.slice(0, 5));
    const author = pick(random, repo.authors);
    const contributor = contributors.find((item) => item.name === author);
    if (contributor) contributor.commits += 1;
    const timestamp = new Date(BASE_TIME - repo.startDaysAgo * DAY + index * ((repo.startDaysAgo * DAY) / commitCount)).toISOString();
    const commitSha = sha(repoId, index, branch, category);
    const parent = branchTips.get(branch) ?? branchTips.get("main");
    const isMerge = index > 0 && index % 53 === 0;
    const mergeParent = isMerge ? branchTips.get("develop") ?? branchTips.get("main") : null;
    const affectedFiles = topic.files.slice(0, 1 + Math.floor(random() * topic.files.length)).map((file) => ({
      path: file,
      module: pick(random, topic.modules),
      changeType: pick(random, ["added", "modified", "renamed", "deleted"]),
      additions: 4 + Math.floor(random() * 160),
      deletions: Math.floor(random() * 80),
      owner: pick(random, repo.authors),
    }));
    for (const file of affectedFiles) {
      const entry = files.get(file.path) ?? { path: file.path, module: file.module, commits: 0, owners: new Set() };
      entry.commits += 1;
      entry.owners.add(file.owner);
      files.set(file.path, entry);
      moduleOwners.set(file.module, file.owner);
    }
    const message = isMerge
      ? `Merge ${branch} into main for ${topic.label.toLowerCase()}`
      : makeMessage(category, topic);
    const risk = Number(
      Math.min(
        0.98,
        Math.max(0.04, (category === "hotfix" ? 0.72 : category === "release" ? 0.5 : 0.18) + affectedFiles.length * 0.04 + random() * 0.18)
      ).toFixed(2)
    );
    const confidence = Number(Math.max(0.55, 0.98 - risk / 2 + random() * 0.04).toFixed(2));
    const prNumber = 1000 + Math.floor(index / 3);
    const issueNumber = 2000 + Math.floor(index / 4);
    const commit = {
      sha: commitSha,
      message,
      author,
      timestamp,
      branch,
      parents: [parent, mergeParent].filter(Boolean),
      pullRequest: prNumber,
      issue: issueNumber,
      category,
      affectedFiles,
      modules: Array.from(new Set(affectedFiles.map((file) => file.module))),
      risk,
      confidence,
      release: category === "release" ? `v${Math.floor(index / 47) + 1}.${Math.floor(random() * 10)}.0` : null,
    };
    commits.push(commit);
    branchTips.set(branch, commitSha);
    if (branch === "main" || isMerge) branchTips.set("main", commitSha);

    const embedding = jitteredEmbedding(random, topicKey, category);
    agentCommits.push({
      repo: repoId,
      sha: commitSha,
      title: `${topic.label} ${category}`,
      intent: `${message} so ${repo.name} can improve ${topic.label.toLowerCase()} while preserving traceable repository intelligence.`,
      notes_for_future_agents: `Risk ${risk}, confidence ${confidence}. Check ${topic.modules.join(", ")} before changing related flows.`,
      embedding,
      category,
      impact: risk > 0.65 ? "high" : risk > 0.35 ? "medium" : "low",
      risk,
      confidence,
      modules: commit.modules,
      branch,
      owner: affectedFiles[0]?.owner ?? author,
      similar_commits: [],
    });

    if (index % 3 === 0) {
      pullRequests.push({
        number: prNumber,
        title: message,
        branch,
        state: index > commitCount - 8 ? "open" : "merged",
        author,
        mergedBy: index > commitCount - 8 ? null : pick(random, repo.authors),
        commitShas: commits.slice(Math.max(0, commits.length - 3)).map((item) => item.sha),
        labels: [category, topic.key],
        createdAt: timestamp,
        mergedAt: index > commitCount - 8 ? null : new Date(Date.parse(timestamp) + DAY).toISOString(),
      });
    }
    if (index % 4 === 0) {
      issues.push({
        number: issueNumber,
        title: `${topic.label} follow-up`,
        state: index > commitCount - 12 ? "open" : "closed",
        labels: [category, topic.key],
        assignee: author,
        linkedPullRequest: prNumber,
        createdAt: timestamp,
        closedAt: index > commitCount - 12 ? null : new Date(Date.parse(timestamp) + 2 * DAY).toISOString(),
      });
    }
    if (category === "release") {
      const tag = commit.release;
      tags.push({ name: tag, sha: commitSha, createdAt: timestamp });
      releases.push({
        tag,
        name: `${repo.name} ${tag}`,
        sha: commitSha,
        createdAt: timestamp,
        notes: `Release includes ${topic.label.toLowerCase()}, ${category} validation, and semantic graph backfill.`,
      });
    }
  }

  for (const memory of agentCommits) {
    memory.similar_commits = agentCommits
      .filter((candidate) => candidate.sha !== memory.sha)
      .map((candidate) => ({
        sha: candidate.sha.slice(0, 7),
        similarity: cosine(memory.embedding, candidate.embedding),
        title: candidate.title,
      }))
      .filter((candidate) => candidate.similarity >= 0.88)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  for (const branch of branches) {
    branch.head = branchTips.get(branch.name) ?? branchTips.get("main");
  }

  const fileRows = Array.from(files.values()).map((file) => ({
    path: file.path,
    module: file.module,
    commits: file.commits,
    owners: Array.from(file.owners),
  }));
  for (const contributor of contributors) {
    contributor.ownership = fileRows
      .filter((file) => file.owners.includes(contributor.name))
      .slice(0, 8)
      .map((file) => file.module);
  }

  const latest = commits[commits.length - 1];
  return {
    repository: {
      org: repo.org,
      name: repo.name,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.defaultBranch,
      pushedAt: latest.timestamp,
      stars: 500 + Math.floor(random() * 8000),
      visibility: "private",
      topics: Object.keys(repo.topicWeights),
      branches,
      tags,
      releases,
      contributors,
      files: fileRows,
      pullRequests,
      issues,
      commits,
      moduleOwners: Object.fromEntries(moduleOwners),
    },
    agentCommits,
  };
}

function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return Number((dot / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(3));
}

const built = repos.map(buildRepo);
const db = {
  generatedAt: new Date(BASE_TIME).toISOString(),
  seedVersion: 2,
  deterministic: true,
  maxCommitsPerRepo,
  repositories: built.map((item) => item.repository),
  agentCommits: built.flatMap((item) => item.agentCommits),
};

writeFileSync(OUTPUT, `${JSON.stringify(db, null, 2)}\n`);

const totalCommits = db.repositories.reduce((sum, repo) => sum + repo.commits.length, 0);
console.log(`Generated ${db.repositories.length} repositories, ${totalCommits} commits, ${db.agentCommits.length} agent memories at ${OUTPUT}`);
console.log(`Max commits per repo: ${maxCommitsPerRepo}`);

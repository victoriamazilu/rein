import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Commit, RepositorySummary, SemanticCommitGraph, WorkspaceRepo } from "./types";
import { repoKey } from "./types";

type LocalCommitRow = {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  branch?: string;
  parents?: string[];
  category?: string;
  pullRequest?: number;
  issue?: number;
  release?: string | null;
  modules?: string[];
  affectedFiles?: Array<{
    path: string;
    module: string;
    changeType: string;
    additions: number;
    deletions: number;
    owner: string;
  }>;
  risk?: number;
  confidence?: number;
};

type LocalRepositoryRow = {
  org: string;
  name: string;
  url: string;
  description: string;
  language: string;
  defaultBranch: string;
  pushedAt: string;
  commits: LocalCommitRow[];
};

type LocalAgentCommitRow = {
  repo: string;
  sha: string;
  title: string | null;
  intent: string;
  notes_for_future_agents: string;
  embedding?: number[];
  category?: string;
  impact?: string;
  risk?: number;
  confidence?: number;
  modules?: string[];
  branch?: string;
  owner?: string;
  similar_commits?: Array<{
    sha: string;
    title: string;
    similarity: number;
  }>;
};

type LocalRepositoryDb = {
  repositories: LocalRepositoryRow[];
  agentCommits: LocalAgentCommitRow[];
};

let cachedDb: LocalRepositoryDb | null = null;
const SEMANTIC_GRAPH_THRESHOLD = 0.82;
const SEMANTIC_EDGE_FLOOR = 0.68;

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function firstLine(message: string): string {
  return message.split("\n")[0]?.trim() ?? message;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function relatedMemories(memory: LocalAgentCommitRow, allMemories: LocalAgentCommitRow[]) {
  if (!memory.embedding) return [];

  return allMemories
    .filter((candidate) => candidate.sha !== memory.sha && candidate.embedding)
    .map((candidate) => ({
      sha: candidate.sha.slice(0, 7),
      title: candidate.title ?? firstLine(candidate.intent),
      similarity: Number(cosineSimilarity(memory.embedding!, candidate.embedding!).toFixed(3)),
    }))
    .filter((candidate) => candidate.similarity >= SEMANTIC_GRAPH_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

function embeddingTopic(embedding: number[]): string {
  const topics = [
    "workspace",
    "evaluation",
    "release",
    "policy",
    "search",
    "fixtures",
    "traceability",
    "interface",
  ];
  const strongest = embedding.reduce(
    (best, value, index) => (value > best.value ? { index, value } : best),
    { index: 0, value: -Infinity }
  );
  return topics[strongest.index] ?? "semantic";
}

function hashUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function rawEmbeddingPoint(memory: LocalAgentCommitRow) {
  const e = memory.embedding ?? [];
  const value = (index: number) => e[index] ?? 0;
  const bridge = Math.min(value(4), value(5), value(6));
  const isolated = value(4) > 0.9 || value(5) > 0.9 ? 0.28 : 0;

  return {
    x:
      -1.1 * value(0) +
      1.15 * value(1) +
      0.42 * value(2) +
      0.98 * value(3) +
      0.35 * value(4) -
      0.28 * value(5) +
      isolated +
      (hashUnit(memory.sha) - 0.5) * 0.16,
    y:
      -0.55 * value(0) -
      0.25 * value(1) +
      0.72 * value(2) +
      0.98 * value(3) +
      0.28 * value(4) +
      0.42 * value(6) +
      0.22 * value(7) -
      bridge * 0.32 +
      (hashUnit(`${memory.sha}:y`) - 0.5) * 0.16,
  };
}

function normalizePoints(points: Array<{ id: string; rawX: number; rawY: number }>) {
  const xs = points.map((point) => point.rawX);
  const ys = points.map((point) => point.rawY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;

  return new Map(
    points.map((point) => {
      const x = points.length === 1 ? 0.5 : 0.08 + ((point.rawX - minX) / xSpan) * 0.84;
      const y = points.length === 1 ? 0.5 : 0.1 + ((point.rawY - minY) / ySpan) * 0.8;
      return [point.id, { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) }];
    })
  );
}

function buildSemanticGraph(
  memories: LocalAgentCommitRow[],
  commits: LocalCommitRow[]
): SemanticCommitGraph {
  const commitMap = new Map(commits.map((commit) => [commit.sha, commit]));
  const embeddedMemories = memories.filter((memory) => memory.embedding);
  const rawPoints = embeddedMemories.map((memory) => {
    const raw = rawEmbeddingPoint(memory);
    return { id: memory.sha.slice(0, 7), rawX: raw.x, rawY: raw.y };
  });
  const positions = normalizePoints(rawPoints);

  const nodes = embeddedMemories.map((memory) => {
    const id = memory.sha.slice(0, 7);
    const commit = commitMap.get(memory.sha);
    const position = positions.get(id) ?? { x: 0.5, y: 0.5 };
    return {
      id: memory.sha.slice(0, 7),
      sha: memory.sha.slice(0, 7),
      title: memory.title ?? firstLine(memory.intent),
      intent: memory.intent,
      message: commit ? firstLine(commit.message) : memory.title ?? firstLine(memory.intent),
      author: commit?.author ?? "Unknown",
      timestamp: commit?.timestamp ?? "",
      topic: embeddingTopic(memory.embedding!),
      x: position.x,
      y: position.y,
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = [];
  const edgesBySource = new Map<string, Array<{ from: string; to: string; weight: number }>>();

  for (let i = 0; i < memories.length; i++) {
    const source = memories[i];
    if (!source.embedding) continue;
    const sourceId = source.sha.slice(0, 7);

    for (let j = i + 1; j < memories.length; j++) {
      const target = memories[j];
      if (!target.embedding) continue;

      const weight = Number(cosineSimilarity(source.embedding, target.embedding).toFixed(3));
      if (weight < SEMANTIC_EDGE_FLOOR) continue;

      const from = sourceId;
      const to = target.sha.slice(0, 7);
      if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
      const sourceEdges = edgesBySource.get(from) ?? [];
      sourceEdges.push({ from, to, weight });
      edgesBySource.set(from, sourceEdges);
    }
  }

  for (const sourceEdges of edgesBySource.values()) {
    edges.push(...sourceEdges.sort((a, b) => b.weight - a.weight).slice(0, 4));
  }

  return {
    nodes,
    edges: edges.sort((a, b) => b.weight - a.weight),
    threshold: SEMANTIC_GRAPH_THRESHOLD,
  };
}

async function readLocalDb(): Promise<LocalRepositoryDb> {
  if (cachedDb) return cachedDb;

  const dbPath =
    process.env.REIN_LOCAL_REPOSITORY_DB ??
    path.join(process.cwd(), "data", "local-repository-db.json");
  const raw = await readFile(dbPath, "utf8");
  cachedDb = JSON.parse(raw) as LocalRepositoryDb;
  return cachedDb;
}

export async function listLocalWorkspaceRepos(): Promise<WorkspaceRepo[]> {
  const db = await readLocalDb();
  return db.repositories.map((repo, index) => ({
    org: repo.org,
    name: repo.name,
    url: repo.url,
    addedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  }));
}

export async function loadLocalRepositoryData(
  org: string,
  name: string
): Promise<{ summary: RepositorySummary; commits: Commit[]; graph: SemanticCommitGraph } | null> {
  const db = await readLocalDb();
  const key = repoKey(org, name);
  const repository = db.repositories.find((repo) => repoKey(repo.org, repo.name) === key);
  if (!repository) return null;

  const repoMemories = db.agentCommits.filter((row) => row.repo === key);
  const graph = buildSemanticGraph(repoMemories, repository.commits);
  const memoryMap = new Map<string, LocalAgentCommitRow>();
  for (const memory of repoMemories) {
    memoryMap.set(memory.sha, memory);
    memoryMap.set(memory.sha.slice(0, 7), memory);
  }

  const commits = repository.commits
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((commit) => {
      const memory = memoryMap.get(commit.sha) ?? memoryMap.get(commit.sha.slice(0, 7));
      return {
        sha: commit.sha.slice(0, 7),
        message: firstLine(commit.message),
        author: commit.author,
        timestamp: commit.timestamp,
        relativeTime: formatRelative(commit.timestamp),
        branch: commit.branch,
        parents: commit.parents?.map((parent) => parent.slice(0, 7)),
        category: commit.category,
        pullRequest: commit.pullRequest,
        issue: commit.issue,
        release: commit.release,
        modules: commit.modules,
        affectedFiles: commit.affectedFiles,
        risk: commit.risk,
        confidence: commit.confidence,
        memory: memory
          ? {
              title: memory.title ?? firstLine(memory.intent),
              intent: memory.intent,
              notes: memory.notes_for_future_agents,
              category: memory.category,
              impact: memory.impact,
              risk: memory.risk,
              confidence: memory.confidence,
              modules: memory.modules,
              owner: memory.owner,
              related: relatedMemories(memory, repoMemories),
              similarCommits: memory.similar_commits,
            }
          : undefined,
      };
    });

  return {
    summary: {
      description: repository.description,
      language: repository.language,
      lastUpdatedLabel: formatRelative(repository.pushedAt),
      defaultBranch: repository.defaultBranch,
      commitCount: repository.commits.length,
      memoryCount: repoMemories.length,
      embeddingCount: repoMemories.filter((row) => row.embedding).length,
      semanticEdgeCount: graph.edges.filter((edge) => edge.weight >= graph.threshold).length,
    },
    commits,
    graph,
  };
}

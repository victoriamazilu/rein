import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { git, isInsideGitRepo } from "./git.js";
import type { AgentCommit } from "./types.js";
import {
  addSearchEdges,
  buildMemoryGraph as buildMemoryGraphCore,
  cosineSimilarity,
  DEFAULT_SEMANTIC_THRESHOLD,
  intentToTitle,
  parseEmbedding,
  renderGraphHtml,
  shortenGraphLabel,
  type GraphEdge,
  type GraphNode,
  type MemoryGraph,
} from "./graphCore.js";

export {
  addSearchEdges,
  cosineSimilarity,
  DEFAULT_SEMANTIC_THRESHOLD,
  intentToTitle,
  parseEmbedding,
  renderGraphHtml,
  shortenGraphLabel,
  type GraphEdge,
  type GraphNode,
  type MemoryGraph,
};

function getCommitSubject(sha: string): string | null {
  if (!isInsideGitRepo()) return null;
  try {
    return git(["show", "-s", "--format=%s", sha]);
  } catch {
    return null;
  }
}

export function buildMemoryGraph(
  commits: AgentCommit[],
  opts?: { similarityThreshold?: number; maxSemanticEdgesPerNode?: number }
): MemoryGraph {
  const enriched = commits.map((commit) => {
    if (commit.title?.trim()) return commit;
    const subject = getCommitSubject(commit.sha);
    return subject ? { ...commit, title: subject } : commit;
  });
  return buildMemoryGraphCore(enriched, opts);
}

export function writeGraphHtml(path: string, graph: MemoryGraph, title?: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderGraphHtml(graph, title), "utf-8");
}

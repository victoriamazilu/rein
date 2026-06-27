import {
  buildMemoryGraph,
  DEFAULT_SEMANTIC_THRESHOLD,
  renderGraphHtml,
} from "../src/graphCore";
import type { AgentCommit } from "../src/types";
import { UI_GRAPH_THRESHOLD } from "./graphConfig";
import { isLocalSeedRepo } from "./localSeedRepos";
import { listLocalAgentCommitsForGraph } from "./localRepositoryDb";
import { createSupabaseAdmin } from "./supabase";
import { repoKey } from "./types";

export type GraphGenerationResult = {
  html: string;
  nodeCount: number;
  edgeCount: number;
  threshold: number;
  repoId: string;
};

export { DEFAULT_SEMANTIC_THRESHOLD };
export { UI_GRAPH_THRESHOLD };

async function listRemoteAgentCommits(repoId: string): Promise<AgentCommit[]> {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("agent_commits")
    .select(
      "id, repo, sha, title, intent, reasoning_trace, notes_for_future_agents, embedding_text, embedding, created_at"
    )
    .eq("repo", repoId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AgentCommit[];
}

async function listGraphCommits(org: string, name: string): Promise<AgentCommit[]> {
  const source = process.env.REIN_REPOSITORY_DATA_SOURCE ?? "auto";
  const repoId = repoKey(org, name);

  if (source === "local") {
    return listLocalAgentCommitsForGraph(org, name);
  }

  if (source === "auto" && isLocalSeedRepo(org, name)) {
    const localCommits = await listLocalAgentCommitsForGraph(org, name);
    if (localCommits.length > 0) return localCommits;
  }

  return listRemoteAgentCommits(repoId);
}

export async function generateRepositoryGraphHtml(
  org: string,
  name: string,
  threshold = DEFAULT_SEMANTIC_THRESHOLD
): Promise<GraphGenerationResult> {
  const repoId = repoKey(org, name);
  const commits = await listGraphCommits(org, name);
  if (commits.length === 0) {
    throw new Error(
      `No agent_commits for ${repoId}. Clone locally and run \`rein backfill --repo ${repoId}\`.`
    );
  }

  const graph = buildMemoryGraph(commits, { similarityThreshold: threshold });
  const title = `Rein Memory Graph — ${repoId}`;

  return {
    html: renderGraphHtml(graph, title),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    threshold: graph.semanticThreshold,
    repoId,
  };
}

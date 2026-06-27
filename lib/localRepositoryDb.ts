import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentCommit } from "../src/types";
import type { Commit, RepositorySummary, WorkspaceRepo } from "./types";
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
  embedding?: number[] | string | null;
  category?: string;
  impact?: string;
  risk?: number;
  confidence?: number;
  modules?: string[];
  branch?: string;
  owner?: string;
};

type LocalRepositoryDb = {
  repositories: LocalRepositoryRow[];
  agentCommits: LocalAgentCommitRow[];
};

let cachedDb: LocalRepositoryDb | null = null;

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
): Promise<{ summary: RepositorySummary; commits: Commit[] } | null> {
  const db = await readLocalDb();
  const key = repoKey(org, name);
  const repository = db.repositories.find((repo) => repoKey(repo.org, repo.name) === key);
  if (!repository) return null;

  const repoMemories = db.agentCommits.filter((row) => row.repo === key);
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
    },
    commits,
  };
}

export async function listLocalAgentCommitsForGraph(
  org: string,
  name: string
): Promise<AgentCommit[]> {
  const db = await readLocalDb();
  const key = repoKey(org, name);
  const repository = db.repositories.find((repo) => repoKey(repo.org, repo.name) === key);
  if (!repository) return [];

  const commitTimestamps = new Map(
    repository.commits.map((commit) => [commit.sha, commit.timestamp])
  );

  return db.agentCommits
    .filter((row) => row.repo === key)
    .map((row) => ({
      id: `${row.repo}:${row.sha}`,
      repo: row.repo,
      sha: row.sha,
      title: row.title,
      intent: row.intent,
      reasoning_trace: row.intent,
      notes_for_future_agents: row.notes_for_future_agents,
      embedding_text: `${row.title ?? ""}\n${row.intent}\n${row.notes_for_future_agents}`.trim(),
      embedding: row.embedding ?? null,
      created_at: commitTimestamps.get(row.sha) ?? repository.pushedAt,
    }));
}

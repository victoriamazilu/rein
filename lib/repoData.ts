import {
  countGitHubCommits,
  fetchGitHubRepo,
  fetchRecentGitHubCommits,
  GitHubError,
  type GitHubCommit,
} from "./github";
import { listAgentCommitsForRepo, countAgentCommitsForRepo } from "./supabase";
import type { Commit, RepositorySummary } from "./types";
import { repoKey } from "./types";

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

function memoryBySha(
  rows: Awaited<ReturnType<typeof listAgentCommitsForRepo>>
): Map<string, (typeof rows)[number]> {
  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    map.set(row.sha, row);
    map.set(row.sha.slice(0, 7), row);
  }
  return map;
}

function gitHubCommitToView(
  commit: GitHubCommit,
  memoryMap: Map<string, Awaited<ReturnType<typeof listAgentCommitsForRepo>>[number]>
): Commit {
  const memory = memoryMap.get(commit.sha) ?? memoryMap.get(commit.sha.slice(0, 7));
  const timestamp = commit.commit.author.date;

  return {
    sha: commit.sha.slice(0, 7),
    message: firstLine(commit.commit.message),
    author: commit.author?.login ?? commit.commit.author.name,
    timestamp,
    relativeTime: formatRelative(timestamp),
    memory: memory
      ? {
          title: memory.title ?? firstLine(memory.intent),
          intent: memory.intent,
          notes: memory.notes_for_future_agents,
        }
      : undefined,
  };
}

export type RepoDataResult = {
  summary: RepositorySummary;
  commits: Commit[];
};

export async function loadRepositoryData(org: string, name: string): Promise<RepoDataResult> {
  const repoId = repoKey(org, name);
  const githubRepo = await fetchGitHubRepo(org, name);
  const branch = githubRepo.default_branch;

  const [commitCount, recentCommits, agentRows, memoryCount] = await Promise.all([
    countGitHubCommits(org, name, branch),
    fetchRecentGitHubCommits(org, name, branch, 30),
    listAgentCommitsForRepo(repoId).catch(() => [] as Awaited<ReturnType<typeof listAgentCommitsForRepo>>),
    countAgentCommitsForRepo(repoId).catch(() => 0),
  ]);

  const memoryMap = memoryBySha(agentRows);
  const commits = recentCommits.map((commit) => gitHubCommitToView(commit, memoryMap));

  return {
    summary: {
      description: githubRepo.description ?? "No description.",
      language: githubRepo.language ?? "—",
      lastUpdatedLabel: githubRepo.pushed_at
        ? formatRelative(githubRepo.pushed_at)
        : "—",
      defaultBranch: branch,
      commitCount,
      memoryCount,
    },
    commits,
  };
}

export { GitHubError };

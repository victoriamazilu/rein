import { parseRepoUrl } from "./repoUrl";
import { localWorkspaceRepos } from "./localWorkspaceSeed";
import type { WorkspaceRepo } from "./types";
import { repoKey } from "./types";

const STORAGE_KEY = "rein-workspace";

export function loadWorkspace(): WorkspaceRepo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedLocalWorkspace();
    const parsed = JSON.parse(raw) as WorkspaceRepo[];
    return Array.isArray(parsed) ? mergeSeedWorkspace(parsed) : [];
  } catch {
    return seedLocalWorkspace();
  }
}

export function saveWorkspace(repos: WorkspaceRepo[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
}

function seedLocalWorkspace(): WorkspaceRepo[] {
  if (process.env.NEXT_PUBLIC_REIN_SEED_LOCAL_WORKSPACE === "0") return [];
  saveWorkspace(localWorkspaceRepos);
  return localWorkspaceRepos;
}

function mergeSeedWorkspace(repos: WorkspaceRepo[]): WorkspaceRepo[] {
  if (process.env.NEXT_PUBLIC_REIN_SEED_LOCAL_WORKSPACE === "0") return repos;

  const existing = new Set(repos.map((repo) => repoKey(repo.org, repo.name)));
  const missingSeeds = localWorkspaceRepos.filter(
    (repo) => !existing.has(repoKey(repo.org, repo.name))
  );
  if (missingSeeds.length === 0) return repos;

  const merged = [...missingSeeds, ...repos];
  saveWorkspace(merged);
  return merged;
}

export function addRepository(url: string): WorkspaceRepo {
  const parsed = parseRepoUrl(url);
  const repos = loadWorkspace();
  const key = repoKey(parsed.org, parsed.name);

  if (repos.some((repo) => repoKey(repo.org, repo.name) === key)) {
    throw new Error(`Repository ${key} is already in your workspace.`);
  }

  const entry: WorkspaceRepo = {
    url: parsed.url,
    org: parsed.org,
    name: parsed.name,
    addedAt: new Date().toISOString(),
  };

  saveWorkspace([entry, ...repos]);
  return entry;
}

export function removeRepository(org: string, name: string): void {
  const key = repoKey(org, name);
  saveWorkspace(loadWorkspace().filter((repo) => repoKey(repo.org, repo.name) !== key));
}

export function listOrganizations(repos: WorkspaceRepo[]) {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    counts.set(repo.org, (counts.get(repo.org) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, repoCount]) => ({ slug, name: slug, repoCount }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getWorkspaceRepo(
  repos: WorkspaceRepo[],
  org: string,
  name: string
): WorkspaceRepo | undefined {
  return repos.find((item) => item.org === org && item.name === name);
}

export function listWorkspaceReposForOrg(repos: WorkspaceRepo[], orgSlug: string): WorkspaceRepo[] {
  return repos
    .filter((repo) => repo.org === orgSlug)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

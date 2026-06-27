export type AgentMemory = {
  title: string;
  intent: string;
  notes: string;
};

export type Commit = {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  relativeTime: string;
  memory?: AgentMemory;
};

export type WorkspaceRepo = {
  url: string;
  org: string;
  name: string;
  addedAt: string;
};

export type RepositorySummary = {
  description: string;
  language: string;
  lastUpdatedLabel: string;
  defaultBranch: string;
  commitCount: number;
  memoryCount: number;
};

export type RepositoryView = WorkspaceRepo &
  RepositorySummary & {
    commits: Commit[];
  };

export type OrganizationView = {
  slug: string;
  name: string;
  repoCount: number;
};

export function repoKey(org: string, name: string): string {
  return `${org}/${name}`;
}

export function repoPath(org: string, name: string): string {
  return `/${org}/${name}`;
}

export function orgPath(slug: string): string {
  return `/${slug}`;
}

export type AgentMemory = {
  title: string;
  intent: string;
  notes: string;
  category?: string;
  impact?: string;
  risk?: number;
  confidence?: number;
  modules?: string[];
  owner?: string;
  related?: Array<{
    sha: string;
    title: string;
    similarity: number;
  }>;
  similarCommits?: Array<{
    sha: string;
    title: string;
    similarity: number;
  }>;
};

export type Commit = {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  relativeTime: string;
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
  memory?: AgentMemory;
};

export type SemanticGraphNode = {
  id: string;
  sha: string;
  title: string;
  intent: string;
  message: string;
  author: string;
  timestamp: string;
  topic: string;
  x: number;
  y: number;
};

export type SemanticGraphEdge = {
  from: string;
  to: string;
  weight: number;
};

export type SemanticCommitGraph = {
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
  threshold: number;
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
  embeddingCount?: number;
  semanticEdgeCount?: number;
};

export type RepositoryView = WorkspaceRepo &
  RepositorySummary & {
    commits: Commit[];
    graph?: SemanticCommitGraph;
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

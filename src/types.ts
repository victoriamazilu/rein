export const AGENT_COMMIT_PREFIX = "rein:";

export interface AgentCommit {
  id: string;
  git_sha: string;
  repo: string;
  created_at: string;
}

export function agentCommitId(gitSha: string): string {
  return `${AGENT_COMMIT_PREFIX}${gitSha}`;
}

export function parseAgentCommitId(id: string): string | null {
  if (!id.startsWith(AGENT_COMMIT_PREFIX)) return null;
  return id.slice(AGENT_COMMIT_PREFIX.length);
}

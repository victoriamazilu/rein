export interface AgentCommit {
  id: string;
  repo: string;
  sha: string;
  title?: string | null;
  intent: string;
  reasoning_trace: string;
  notes_for_future_agents: string;
  embedding_text: string;
  embedding?: number[] | string | null;
  created_at: string;
}

export interface DistilledAgentCommit {
  title: string;
  commit_message: string;
  intent: string;
  reasoning_trace: string;
  notes_for_future_agents: string;
  embedding_text: string;
}

export interface AgentCommitSearchResult extends AgentCommit {
  vector_similarity: number;
  keyword_rank: number;
  combined_score: number;
}

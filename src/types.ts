export interface AgentCommit {
  id: string;
  sha: string;
  intent: string;
  reasoning_trace: string;
  notes_for_future_agents: string;
  embedding_text: string;
  embedding?: number[] | string | null;
  created_at: string;
}

export interface DistilledAgentCommit {
  commit_message: string;
  intent: string;
  reasoning_trace: string;
  notes_for_future_agents: string;
  embedding_text: string;
}

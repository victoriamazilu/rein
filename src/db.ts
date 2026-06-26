import type { SupabaseClient } from "@supabase/server/peer/supabase-js";
import { agentCommitId, type AgentCommit } from "./types.js";

export class AgentCommitStore {
  constructor(private supabase: SupabaseClient) {}

  async create(gitSha: string, repo: string): Promise<AgentCommit> {
    const id = agentCommitId(gitSha);
    const { data, error } = await this.supabase
      .from("agent_commits")
      .insert({ id, git_sha: gitSha, repo })
      .select()
      .single();

    if (error) throw error;
    return data as AgentCommit;
  }

  async getById(id: string): Promise<AgentCommit | null> {
    const { data, error } = await this.supabase
      .from("agent_commits")
      .select()
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return (data as AgentCommit | null) ?? null;
  }

  async getBySha(gitSha: string): Promise<AgentCommit | null> {
    const { data, error } = await this.supabase
      .from("agent_commits")
      .select()
      .eq("git_sha", gitSha)
      .maybeSingle();

    if (error) throw error;
    return (data as AgentCommit | null) ?? null;
  }

  async listByRepo(repo: string): Promise<AgentCommit[]> {
    const { data, error } = await this.supabase
      .from("agent_commits")
      .select()
      .eq("repo", repo)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as AgentCommit[];
  }
}

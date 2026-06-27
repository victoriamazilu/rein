import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentCommit, AgentCommitSearchResult } from "./types.js";

const AGENT_COMMIT_FIELDS =
  "id, repo, sha, title, intent, reasoning_trace, notes_for_future_agents, embedding_text, created_at";

function throwDbError(error: PostgrestError): never {
  let hint = "";
  if (error.code === "42703") {
    if (error.message.includes("title")) {
      hint = " Run `npm run db:migrate:title` to add the title column.";
    } else if (error.message.includes("repo")) {
      hint = " Run `npm run db:migrate:repo` to add the repo column.";
    }
  }
  throw new Error(`${error.message}${hint}`);
}

export function createSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class AgentCommitStore {
  constructor(private supabase: SupabaseClient) {}

  async create(input: Omit<AgentCommit, "id" | "created_at">): Promise<AgentCommit>;
  async create(sha: string, repo: string): Promise<AgentCommit>;
  async create(
    inputOrSha: Omit<AgentCommit, "id" | "created_at"> | string,
    repo?: string
  ): Promise<AgentCommit> {
    const input =
      typeof inputOrSha === "string"
        ? {
            repo: repo ?? "unknown",
            sha: inputOrSha,
            title: "Legacy Registration",
            intent: "Legacy API registration",
            reasoning_trace: "Registered through the compatibility API without distillation.",
            notes_for_future_agents: "No semantic memory was generated for this commit.",
            embedding_text: `Legacy registration for commit ${inputOrSha}`,
            embedding: null,
          }
        : inputOrSha;

    const { data, error } = await this.supabase
      .from("agent_commits")
      .insert(input)
      .select()
      .single();

    if (error) throwDbError(error);
    return data as AgentCommit;
  }

  async upsert(input: Omit<AgentCommit, "id" | "created_at">): Promise<AgentCommit> {
    const { data, error } = await this.supabase
      .from("agent_commits")
      .upsert(input, { onConflict: "repo,sha" })
      .select()
      .single();

    if (error) throwDbError(error);
    return data as AgentCommit;
  }

  async getById(id: string): Promise<AgentCommit | null> {
    const { data, error } = await this.supabase
      .from("agent_commits")
      .select(AGENT_COMMIT_FIELDS)
      .eq("id", id)
      .maybeSingle();

    if (error) throwDbError(error);
    return (data as AgentCommit | null) ?? null;
  }

  async getBySha(sha: string, repo: string): Promise<AgentCommit | null> {
    const { data, error } = await this.supabase
      .from("agent_commits")
      .select(AGENT_COMMIT_FIELDS)
      .eq("sha", sha)
      .eq("repo", repo)
      .maybeSingle();

    if (error) throwDbError(error);
    return (data as AgentCommit | null) ?? null;
  }

  async listByRepo(repo: string): Promise<AgentCommit[]> {
    const { data, error } = await this.supabase
      .from("agent_commits")
      .select(`${AGENT_COMMIT_FIELDS}, embedding`)
      .eq("repo", repo)
      .order("created_at", { ascending: true });

    if (error) throwDbError(error);
    return (data ?? []) as AgentCommit[];
  }

  async search(
    queryText: string,
    queryEmbedding: number[],
    repo: string,
    matchCount = 10
  ): Promise<AgentCommitSearchResult[]> {
    const { data, error } = await this.supabase.rpc("match_agent_commits", {
      query_text: queryText,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      filter_repo: repo,
    });

    if (error) throwDbError(error);
    return (data ?? []) as AgentCommitSearchResult[];
  }
}

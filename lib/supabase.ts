import { createClient } from "@supabase/supabase-js";

type AgentCommitRow = {
  sha: string;
  title: string | null;
  intent: string;
  notes_for_future_agents: string;
};

export function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase credentials in .env");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listAgentCommitsForRepo(repo: string): Promise<AgentCommitRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("agent_commits")
    .select("sha, title, intent, notes_for_future_agents")
    .eq("repo", repo)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AgentCommitRow[];
}

export async function countAgentCommitsForRepo(repo: string): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { count, error } = await supabase
    .from("agent_commits")
    .select("id", { count: "exact", head: true })
    .eq("repo", repo);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type { AgentCommitRow };

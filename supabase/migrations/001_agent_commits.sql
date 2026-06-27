-- AgentGit MVP schema.
-- Run this in the Supabase SQL editor or via `supabase db push`.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- MVP/dev reset: the earlier prototype used a different agent_commits shape
-- (git_sha/repo only). Recreate the table so setup is deterministic.
drop function if exists public.match_agent_commits(vector, text, int);
drop table if exists public.agent_commits cascade;

create table public.agent_commits (
  id uuid primary key default gen_random_uuid(),
  sha text not null unique,

  intent text not null,
  reasoning_trace text not null,
  notes_for_future_agents text not null,
  embedding_text text not null,

  embedding vector(1536),

  created_at timestamptz not null default now()
);

alter table public.agent_commits
add column if not exists search_vector tsvector generated always as (
  to_tsvector(
    'english',
    coalesce(intent, '') || ' ' ||
    coalesce(reasoning_trace, '') || ' ' ||
    coalesce(notes_for_future_agents, '') || ' ' ||
    coalesce(embedding_text, '')
  )
) stored;

create index if not exists agent_commits_search_idx
on public.agent_commits using gin(search_vector);

create index if not exists agent_commits_embedding_idx
on public.agent_commits
using ivfflat (embedding vector_cosine_ops);

create or replace function public.match_agent_commits(
  query_embedding vector(1536),
  query_text text,
  match_count int default 10
)
returns table (
  id uuid,
  sha text,
  intent text,
  reasoning_trace text,
  notes_for_future_agents text,
  embedding_text text,
  vector_similarity float,
  keyword_rank float,
  combined_score float
)
language sql stable
as $$
  with params as (
    select
      plainto_tsquery('english', query_text) as ts_query,
      greatest(match_count * 4, 20) as candidate_count
  ),

  vector_candidates as (
    select
      ac.id,
      1 - (ac.embedding <=> query_embedding) as vector_similarity
    from public.agent_commits ac, params p
    where ac.embedding is not null
    order by ac.embedding <=> query_embedding
    limit (select candidate_count from params)
  ),

  keyword_candidates as (
    select
      ac.id,
      ts_rank_cd(ac.search_vector, p.ts_query) as keyword_rank
    from public.agent_commits ac, params p
    where ac.search_vector @@ p.ts_query
    order by keyword_rank desc
    limit (select candidate_count from params)
  ),

  candidates as (
    select id from vector_candidates
    union
    select id from keyword_candidates
  )

  select
    ac.id,
    ac.sha,
    ac.intent,
    ac.reasoning_trace,
    ac.notes_for_future_agents,
    ac.embedding_text,

    coalesce(vc.vector_similarity, 0) as vector_similarity,
    coalesce(kc.keyword_rank, 0) as keyword_rank,

    (
      0.65 * coalesce(vc.vector_similarity, 0) +
      0.35 * coalesce(kc.keyword_rank / nullif(kc.keyword_rank + 1, 0), 0)
    ) as combined_score

  from candidates c
  join public.agent_commits ac on ac.id = c.id
  left join vector_candidates vc on vc.id = c.id
  left join keyword_candidates kc on kc.id = c.id
  order by combined_score desc
  limit match_count;
$$;

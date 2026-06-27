-- Add short LLM-generated titles for search results.

alter table public.agent_commits
add column if not exists title text;

alter table public.agent_commits
drop column if exists search_vector;

alter table public.agent_commits
add column search_vector tsvector generated always as (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(intent, '') || ' ' ||
    coalesce(reasoning_trace, '') || ' ' ||
    coalesce(notes_for_future_agents, '') || ' ' ||
    coalesce(embedding_text, '')
  )
) stored;

create index if not exists agent_commits_search_idx
on public.agent_commits using gin(search_vector);

drop function if exists public.match_agent_commits(vector, text, int);

create or replace function public.match_agent_commits(
  query_embedding vector(1536),
  query_text text,
  match_count int default 10,
  filter_repo text default null
)
returns table (
  id uuid,
  repo text,
  sha text,
  title text,
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
  with parsed as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  )
  select
    ac.id,
    ac.repo,
    ac.sha,
    ac.title,
    ac.intent,
    ac.reasoning_trace,
    ac.notes_for_future_agents,
    ac.embedding_text,

    coalesce(1 - (ac.embedding <=> query_embedding), 0)::float as vector_similarity,

    coalesce(
      ts_rank_cd(ac.search_vector, parsed.tsq),
      0
    )::float as keyword_rank,

    (
      0.65 * coalesce(1 - (ac.embedding <=> query_embedding), 0) +
      0.35 * coalesce(ts_rank_cd(ac.search_vector, parsed.tsq), 0)
    )::float as combined_score

  from public.agent_commits ac
  cross join parsed
  where
    (filter_repo is null or ac.repo = filter_repo)
    and (
      ac.embedding is not null
      or (parsed.tsq is not null and ac.search_vector @@ parsed.tsq)
    )

  order by combined_score desc
  limit match_count;
$$;

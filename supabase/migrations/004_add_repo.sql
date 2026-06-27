-- Multi-repo support: scope agent_commits by repository.

alter table public.agent_commits
add column if not exists repo text;

update public.agent_commits
set repo = 'legacy/unknown'
where repo is null;

alter table public.agent_commits
alter column repo set not null;

alter table public.agent_commits
drop constraint if exists agent_commits_sha_key;

create unique index if not exists agent_commits_repo_sha_key
on public.agent_commits (repo, sha);

create index if not exists agent_commits_repo_idx
on public.agent_commits (repo);

drop function if exists public.match_agent_commits(vector, text, int);
drop function if exists public.match_agent_commits(vector, text, int, text);

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

-- Single-repo installs with existing rows: set your repo slug, then re-run backfill if needed.
-- update public.agent_commits set repo = 'you/rein' where repo = 'legacy/unknown';

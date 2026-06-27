-- Fix hybrid search: always rank rows with embeddings (vector search),
-- and coalesce null scores so short queries like "env" still return results.

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
  with parsed as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  )
  select
    ac.id,
    ac.sha,
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
    ac.embedding is not null
    or (parsed.tsq is not null and ac.search_vector @@ parsed.tsq)

  order by combined_score desc
  limit match_count;
$$;

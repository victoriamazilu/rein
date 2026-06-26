-- Agent commits: 1:1 metadata records paired with git commits.
-- Run this in the Supabase SQL editor or via `supabase db push`.

create table if not exists public.agent_commits (
  id         text primary key,
  git_sha    text not null unique,
  repo       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_commits_repo on public.agent_commits (repo);
create index if not exists idx_agent_commits_git_sha on public.agent_commits (git_sha);

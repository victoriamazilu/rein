# Rein MVP Plan

## Product Goal

Build `rein`, a CLI that augments normal git workflows with durable semantic memory for coding agents.

Core primitive:

```bash
rein commit
```

This should:

1. inspect staged changes
2. ask the current LLM/agent to distill the task into an `AgentCommit`
3. create a real git commit
4. map the resulting git SHA to the `AgentCommit`
5. store the metadata and embedding in Supabase

Git remains the source of truth for code history. Rein stores semantic project memory.

---

## MVP Scope

### Commands

```bash
rein commit
```

Create a git commit and AgentCommit memory.

```bash
rein search "query"
```

Hybrid semantic + keyword search over AgentCommit memory.

```bash
rein show <sha>
```

Show stored AgentCommit metadata for a commit.

---

## AgentCommit Schema

Initial schema:

```ts
type AgentCommit = {
  id: string
  sha: string
  intent: string
  reasoning_trace: string
  notes_for_future_agents: string
  embedding_text: string
}
```

Database will also store:

```ts
embedding: vector
created_at: timestamp
```

No `files_changed` field for now because git already stores that.

---

## Phase 1: Project Setup

### 1. Choose implementation stack

Recommended:

- TypeScript
- Node.js CLI
- Supabase JS client
- OpenAI embeddings or compatible embedding provider
- Postgres `pgvector`
- Postgres full-text search

### 2. Create CLI skeleton

Set up commands:

```bash
rein commit
rein search
rein show
```

Use a CLI framework such as:

- `commander`
- `yargs`
- `cac`

### 3. Add environment config

Required env vars:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Optional later:

```bash
REIN_MODEL=
REIN_EMBEDDING_MODEL=
```

---

## Phase 2: Supabase Schema

### 1. Enable extensions

```sql
create extension if not exists vector;
create extension if not exists pgcrypto;
```

### 2. Create table

```sql
create table agent_commits (
  id uuid primary key default gen_random_uuid(),
  sha text not null unique,

  intent text not null,
  reasoning_trace text not null,
  notes_for_future_agents text not null,
  embedding_text text not null,

  embedding vector(1536),

  created_at timestamptz not null default now()
);
```

Assumes OpenAI `text-embedding-3-small`, which uses 1536 dimensions.

### 3. Add full-text search column

```sql
alter table agent_commits
add column search_vector tsvector generated always as (
  to_tsvector(
    'english',
    coalesce(intent, '') || ' ' ||
    coalesce(reasoning_trace, '') || ' ' ||
    coalesce(notes_for_future_agents, '') || ' ' ||
    coalesce(embedding_text, '')
  )
) stored;
```

### 4. Add indexes

```sql
create index agent_commits_search_idx
on agent_commits using gin(search_vector);

create index agent_commits_embedding_idx
on agent_commits
using ivfflat (embedding vector_cosine_ops);
```

---

## Phase 3: Hybrid Search

### 1. Create Supabase RPC function

```sql
create or replace function match_agent_commits(
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
  select
    ac.id,
    ac.sha,
    ac.intent,
    ac.reasoning_trace,
    ac.notes_for_future_agents,
    ac.embedding_text,

    1 - (ac.embedding <=> query_embedding) as vector_similarity,

    ts_rank_cd(
      ac.search_vector,
      plainto_tsquery('english', query_text)
    ) as keyword_rank,

    (
      0.65 * (1 - (ac.embedding <=> query_embedding)) +
      0.35 * ts_rank_cd(ac.search_vector, plainto_tsquery('english', query_text))
    ) as combined_score

  from agent_commits ac
  where
    ac.search_vector @@ plainto_tsquery('english', query_text)
    or ac.embedding is not null

  order by combined_score desc
  limit match_count;
$$;
```

### 2. Implement `rein search`

Flow:

1. accept query string
2. generate embedding for query
3. call `match_agent_commits`
4. print top results

Example:

```bash
rein search "how do I add admin-only routes?"
```

Output:

```txt
Relevant AgentCommits:

1. abc123 - Add role-based authorization
   Intent: Add role-based authorization for admin-only routes.
   Notes: Use requireRole helper instead of duplicating checks.

2. def456 - Add JWT middleware
   Intent: Centralize token verification in middleware.
   Notes: Extend middleware for future auth changes.
```

---

## Phase 4: `rein commit`

Use Option A:

```txt
staged diff -> LLM distillation -> git commit -> store AgentCommit
```

### 1. Validate git state

Before doing anything:

- ensure current directory is inside a git repo
- ensure staged changes exist
- optionally warn if unstaged changes exist

Commands:

```bash
git rev-parse --is-inside-work-tree
git diff --cached --quiet
git status --short
git diff --cached
```

### 2. Collect commit context

Collect:

```bash
git diff --cached
git status --short
git log -5 --oneline
```

Potentially include previous search results later, but not required for MVP.

### 3. Ask current LLM/agent for distillation

Prompt:

```txt
You just completed a coding task.

Given the staged git diff, produce durable project memory for future coding agents.

Return strict JSON:
{
  "commit_message": string,
  "intent": string,
  "reasoning_trace": string,
  "notes_for_future_agents": string,
  "embedding_text": string
}

Guidelines:
- Be concise but useful.
- Focus on decisions, intent, and future implications.
- Do not describe obvious line-by-line changes.
- Do not include generic advice.
- embedding_text should combine semantic information future agents might search for.
```

Input should include:

```txt
Git status:
...

Recent commits:
...

Staged diff:
...
```

### 4. Validate LLM output

Ensure JSON contains:

- `commit_message`
- `intent`
- `reasoning_trace`
- `notes_for_future_agents`
- `embedding_text`

If invalid:

- retry once with a repair prompt
- otherwise fail before creating the git commit

### 5. Create git commit

Run:

```bash
git commit -m "<commit_message>"
```

Then get SHA:

```bash
git rev-parse HEAD
```

### 6. Generate embedding

Embed `embedding_text`.

For MVP, use OpenAI:

```txt
model: text-embedding-3-small
dimensions: 1536
```

### 7. Store in Supabase

Insert:

```ts
{
  sha,
  intent,
  reasoning_trace,
  notes_for_future_agents,
  embedding_text,
  embedding
}
```

### 8. Handle Supabase failure

If git commit succeeds but Supabase insert fails:

- print a clear warning
- write a local recovery file, e.g.

```txt
.rein/pending/<sha>.json
```

Later command can sync it.

Do not silently lose memory.

---

## Phase 5: `rein show`

Command:

```bash
rein show <sha>
```

Behavior:

1. query Supabase by SHA
2. print AgentCommit metadata

Output:

```txt
Commit: abc123

Intent:
Add role-based authorization for admin-only routes.

Reasoning Trace:
The project already had JWT middleware and a user.role field, so this extends existing auth instead of introducing a new permissions system.

Notes for Future Agents:
Use requireRole for future protected routes. Avoid duplicating role checks in handlers.
```

---

## Phase 7: Local Recovery and Sync

Add local pending memory directory:

```txt
.rein/pending/
```

If memory storage fails after commit creation, save:

```json
{
  "sha": "...",
  "intent": "...",
  "reasoning_trace": "...",
  "notes_for_future_agents": "...",
  "embedding_text": "...",
  "created_at": "..."
}
```

Later add:

```bash
rein sync
```

This will:

1. read pending files
2. generate missing embeddings if needed
3. insert into Supabase
4. delete local pending files after success

This can be post-MVP, but design for it now.

---

## Suggested Implementation Order

1. Create CLI skeleton
2. Add Supabase schema/migrations
3. Implement embedding helper
5. Implement `rein search`
6. Implement git helpers
7. Implement LLM distillation helper
8. Implement `rein commit`
9. Implement `rein show`
10. Add local recovery for failed Supabase inserts
11. Add tests or fixture-based command checks

---

## MVP Acceptance Criteria

### `rein commit`

Given staged changes, running:

```bash
rein commit
```

should:

- generate a commit message
- create a real git commit
- create AgentCommit metadata
- generate an embedding
- store the record in Supabase
- print the new SHA and memory summary

### `rein search`

Given stored AgentCommits, running:

```bash
rein search "auth middleware"
```

should:

- generate a query embedding
- perform hybrid search
- return relevant commits ranked by combined score

### `rein show`

Given a SHA, running:

```bash
rein show <sha>
```

should print the stored semantic memory for that commit.

---

## Future Ideas

Not MVP:

- repo IDs / multi-repo support
- branch-aware memories
- PR and GitHub integration
- team-shared memory policies
- LLM reranking
- automatic pre-task context injection
- `rein sync`
- `rein remember HEAD` for retroactive memory creation
- local-first mode
- richer schema with decisions, risks, tests, and symbols touched

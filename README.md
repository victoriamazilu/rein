# Rein / AgentGit

Rein is an agent-native memory layer on top of git.

Git stores code history. Rein stores semantic memory about commits so future agents can search prior intent, reasoning, and notes before starting work.

The CLI command is:

```bash
agentgit
```

Core primitive:

```bash
agentgit commit
```

This creates a real git commit and stores an `AgentCommit` record in Supabase.

---

## Current commands

```bash
agentgit commit
```

Distills staged changes with an LLM, creates a git commit, embeds the memory text, and stores it in Supabase.

```bash
agentgit search "auth middleware"
```

Hybrid semantic + keyword search over stored AgentCommit memories.

```bash
agentgit show <sha>
```

Show the stored memory for a git commit SHA.

---

## AgentCommit schema

MVP fields:

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

The database also stores:

```ts
embedding: vector
created_at: timestamp
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

Required:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

Optional:

```bash
AGENTGIT_MODEL=gpt-4o-mini
AGENTGIT_EMBEDDING_MODEL=text-embedding-3-small
DATABASE_URL=postgresql://...
```

`DATABASE_URL` is only needed if you want to run the DB setup script from the CLI.

### 3. Apply Supabase schema

Option A: use the script. This requires `DATABASE_URL` in `.env`:

```bash
npm run db:setup
```

The setup script connects directly with `pg` and applies `supabase/migrations/001_agent_commits.sql`. We do not use `supabase db query` here because it can fail on multi-statement migration files with `cannot insert multiple commands into a prepared statement`.

Option B: paste this file into the Supabase SQL editor:

```txt
supabase/migrations/001_agent_commits.sql
```

This creates:

- `agent_commits` table
- `vector` extension
- full-text search column
- vector index
- `match_agent_commits` RPC for hybrid search

### 4. Build

```bash
npm run build
```

### 5. Run the Workspace with local test data

The Workspace page can run against the seeded local database in
`data/local-repository-db.json`. This lets the app exercise repository summaries,
commit tables, filters, memory coverage, and data-derived insights without
depending on a populated Supabase project.

```bash
REIN_REPOSITORY_DATA_SOURCE=local npm run dev
```

Regenerate the deterministic compact seed database:

```bash
npm run seed:local
LOCAL_SEED_MAX_COMMITS=75 npm run seed:local
```

`LOCAL_SEED_MAX_COMMITS` is clamped between 75 and 100 commits per repository.
The default is 90, which keeps the fixture lightweight while preserving branches,
PR/issue references, releases, affected files, semantic embeddings, risk scores,
and graph relationships for every commit.

Useful options:

```bash
REIN_REPOSITORY_DATA_SOURCE=auto
REIN_REPOSITORY_DATA_SOURCE=remote
REIN_LOCAL_REPOSITORY_DB=data/local-repository-db.json
NEXT_PUBLIC_REIN_SEED_LOCAL_WORKSPACE=1
```

`auto` uses the local database for seeded repositories and falls back to the
GitHub/Supabase provider for other repositories. `remote` uses GitHub for commit
metadata and Supabase for AgentCommit memory.

### 6. Link CLI locally

```bash
npm link
```

Then verify:

```bash
agentgit --help
```

Expected:

```txt
Usage: agentgit [options] [command]

Commands:
  commit [options]
  search [options] <query...>
  show <sha>
```

---

## Development usage

You can run without linking:

```bash
npm run agentgit -- --help
npm run agentgit -- search "auth middleware"
npm run agentgit -- commit
```

After linking, use:

```bash
agentgit --help
agentgit search "auth middleware"
agentgit commit
```

---

## Normal workflow

### Before starting a task

Search prior project memory:

```bash
agentgit search "auth middleware"
```

### After finishing a task

Stage changes:

```bash
git add <files>
```

Create git commit + semantic memory:

```bash
agentgit commit
```

Flow:

```txt
staged diff
  -> LLM distillation
  -> git commit
  -> get SHA
  -> generate embedding
  -> store AgentCommit in Supabase
```

Dry run:

```bash
agentgit commit --dry-run
```

This prints the generated commit message and memory without committing.

---

## Example commands from local setup

Build:

```bash
npm run build
```

Run search through npm:

```bash
npm run agentgit -- search "auth middleware"
```

Link CLI:

```bash
npm link
```

Use linked CLI:

```bash
agentgit --help
agentgit search "auth middleware"
```

Apply DB setup:

```bash
npm run db:setup
```

---

## Troubleshooting

### `npm run db:setup` fails with `cannot insert multiple commands into a prepared statement`

This was caused by using `supabase db query` on a multi-statement SQL migration. The setup script now uses the `pg` package directly, so rerun:

```bash
npm install
npm run db:setup
```

### `agentgit search` returns `Error: [object Object]`

This usually means Supabase returned an error object. Common causes:

1. The migration has not been applied.
2. `match_agent_commits` RPC does not exist yet.
3. `vector` extension is not enabled.
4. `.env` has the wrong Supabase key.
5. `OPENAI_API_KEY` is missing or invalid.

Run:

```bash
npm run db:setup
```

Or paste `supabase/migrations/001_agent_commits.sql` into Supabase SQL editor.

Then rebuild:

```bash
npm run build
```

### `No staged changes`

`agentgit commit` only commits staged changes. Run:

```bash
git add <files>
agentgit commit
```

### Supabase insert fails after git commit succeeds

The git commit is not rolled back. Rein writes a recovery file to:

```txt
.agentgit/pending/<sha>.json
```

A future `agentgit sync` command can upload these pending memories.

---

## Project structure

```txt
rein/
├── src/
│   ├── cli.ts      # agentgit commands
│   ├── db.ts       # Supabase client/store
│   ├── git.ts      # git helpers
│   ├── llm.ts      # OpenAI distillation + embeddings
│   ├── types.ts    # AgentCommit types
│   └── server.ts   # older HTTP API compatibility layer
├── supabase/
│   └── migrations/
│       └── 001_agent_commits.sql
├── plan.md
├── package.json
└── tsconfig.json
```

---

## Notes

- Use `agentgit commit`, not `git commit`, when an agent finishes a task.
- Git remains the source of truth for code.
- Supabase stores semantic memory.
- Search is hybrid: OpenAI embeddings + Postgres full-text search.

# Rein

Rein is an agent-native layer on top of GitHub. Git stores code history; Rein stores the agent context that goes with it. Every real git commit has a directly correlated **agent commit** — metadata that other agents can query later.

This README is the onboarding doc for agents (and humans) working in this repo.

---

## Core concepts

### Git commit vs agent commit

| | Git commit | Agent commit |
|---|---|---|
| **What it is** | Standard git history (sha, author, message, diff) | Rein metadata record linked 1:1 to a git commit |
| **Where it lives** | Git / GitHub | Supabase (PostgreSQL) |
| **Who creates it** | Whoever runs `git commit` | The coding agent, via `rein register` |
| **ID** | Git SHA (e.g. `abc123...`) | Prefixed SHA (e.g. `rein:abc123...`) |

```
git commit  ──►  real commit (sha: abc123...)
                      │
                      ▼  1:1
rein register ──►  agent commit (id: rein:abc123...)
                      │
                      ▼
                 Supabase  ──►  queried by other agents
```

Git remains the source of truth for code. Rein is the source of truth for agent-oriented metadata about that code.

---

## Design decisions (locked in)

These are intentional constraints — do not change them without explicit discussion:

1. **When** — An agent commit is created whenever a real commit is created. They are always paired.
2. **Who** — The agent that wrote the code registers the agent commit (not a webhook, not a human).
3. **Relationship** — Strict 1:1. One agent commit per git commit, no exceptions.
4. **ID format** — `rein:<full-git-sha>`. The prefix is `rein:`; the rest is the complete git SHA.
5. **Database** — Supabase (PostgreSQL). Agent commits live in the `agent_commits` table.

---

## Agent workflow

If you are an agent committing code in a Rein-enabled repo, follow this sequence **every time** you create a commit:

```bash
# 1. Make your changes and commit as usual
git add <files>
git commit -m "your message"

# 2. Register the paired agent commit
rein register
# or, during development:
npm run cli -- register
```

`rein register` reads the current `HEAD` SHA and `origin` remote, then POSTs to the Rein API. It prints the agent commit as JSON:

```json
{
  "id": "rein:2eb0ab5b219d96e711deb91b45c55f0ef328cd79",
  "git_sha": "2eb0ab5b219d96e711deb91b45c55f0ef328cd79",
  "repo": "victoriamazilu/rein",
  "created_at": "2026-06-26T23:11:10.000Z"
}
```

Registration is idempotent — calling it twice for the same SHA returns the existing record.

### Prerequisites for `rein register`

- You must be inside a git repo with at least one commit (`HEAD` must exist).
- The repo should have an `origin` remote (used to derive `owner/repo`).
- The Rein API server must be running (see [Running locally](#running-locally)).

---

## Running locally

### Setup

```bash
npm install
cp .env.example .env   # then fill in Supabase credentials
npm run build
```

Requires **Node.js 20+** (required by `@supabase/server`).

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration in `supabase/migrations/001_agent_commits.sql` via the Supabase SQL editor, or with the Supabase CLI:

   ```bash
   supabase db push
   ```

3. Copy credentials from Settings → API into `.env`:

   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
   ```

4. Apply the database migration:

   ```bash
   # Add DATABASE_URL to .env (Settings → Database → Connection string, URI)
   npm run db:setup
   ```

   Or paste `supabase/migrations/001_agent_commits.sql` into the Supabase SQL editor.

   The secret key is used server-side only — it bypasses Row Level Security. Never expose it to clients or commit it to git.

### `@supabase/server`

The API uses [`@supabase/server`](https://github.com/supabase/server) with the Hono adapter. Each route is wrapped with `withSupabase`, which validates auth and injects a Supabase context into `c.var.supabaseContext`:

- **`ctx.supabase`** — RLS-scoped client (publishable key or user JWT)
- **`ctx.supabaseAdmin`** — admin client that bypasses RLS (secret key)

Auth modes per route:

| Route | Auth mode | Client used |
|---|---|---|
| `GET /health` | `none` | — |
| `POST /agent-commits` | `secret` | `supabaseAdmin` |
| `GET /agent-commits/*` | `publishable` or `secret` | `supabase` or `supabaseAdmin` |

On Supabase Edge Functions, env vars are injected automatically. For non-`user` auth modes, set `verify_jwt = false` for the function in `supabase/config.toml`.

### Start the API server

```bash
npm run dev          # watch mode (tsx)
# or
npm start            # production (compiled dist/)
```

Server defaults to `http://localhost:3000`.

### Register a commit

```bash
npm run cli -- register
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | yes | — | Supabase project URL |
| `SUPABASE_SECRET_KEY` | yes | — | Secret key for server-to-server auth (`auth: 'secret'`) |
| `SUPABASE_PUBLISHABLE_KEY` | for reads | — | Publishable key for client-facing reads (`auth: 'publishable'`) |
| `SUPABASE_JWKS_URL` | for user auth | — | JWKS endpoint for JWT verification (`auth: 'user'`) |
| `PORT` | no | `3000` | API server port |
| `REIN_API_URL` | no | `http://localhost:3000` | API URL used by the CLI |

---

## API reference

Base URL: `http://localhost:3000` (or `REIN_API_URL`).

### `POST /agent-commits`

Register an agent commit. Idempotent — returns `200` with the existing record if the SHA is already registered.

**Auth:** `secret` — send the secret key in the `apikey` header.

**Request body:**

```json
{
  "git_sha": "2eb0ab5b219d96e711deb91b45c55f0ef328cd79",
  "repo": "victoriamazilu/rein"
}
```

**Response:** `201 Created` (new) or `200 OK` (existing)

```json
{
  "id": "rein:2eb0ab5b219d96e711deb91b45c55f0ef328cd79",
  "git_sha": "2eb0ab5b219d96e711deb91b45c55f0ef328cd79",
  "repo": "victoriamazilu/rein",
  "created_at": "2026-06-26T23:11:10.000Z"
}
```

### `GET /agent-commits/:id`

Look up by agent commit ID (e.g. `rein:abc123...`).

**Auth:** `publishable` or `secret` — send the key in the `apikey` header.

### `GET /agent-commits/by-sha/:sha`

Look up by raw git SHA (without the `rein:` prefix).

**Auth:** `publishable` or `secret`.

### `GET /repos/:repo/agent-commits`

List all agent commits for a repo. Repo is URL-encoded `owner/repo` (e.g. `victoriamazilu%2Frein`).

**Auth:** `publishable` or `secret`.

Returns an array ordered by `created_at` descending.

---

## Data model

### AgentCommit

```typescript
interface AgentCommit {
  id: string;         // "rein:<git_sha>"
  git_sha: string;    // full git SHA
  repo: string;       // "owner/repo" (normalized from origin remote)
  created_at: string; // ISO 8601 timestamptz from Supabase
}
```

### Supabase schema

Migration: `supabase/migrations/001_agent_commits.sql`

```sql
create table public.agent_commits (
  id         text primary key,       -- rein:<git_sha>
  git_sha    text not null unique,   -- 1:1 with git
  repo       text not null,
  created_at timestamptz not null default now()
);
```

### ID helpers

```typescript
const AGENT_COMMIT_PREFIX = "rein:";

function agentCommitId(gitSha: string): string {
  return `rein:${gitSha}`;
}

function parseAgentCommitId(id: string): string | null {
  if (!id.startsWith("rein:")) return null;
  return id.slice("rein:".length);
}
```

---

## Project structure

```
rein/
├── src/
│   ├── types.ts    # AgentCommit interface, ID helpers (rein:<sha>)
│   ├── db.ts       # Supabase store (AgentCommitStore)
│   ├── git.ts      # Read HEAD sha and origin remote from local git
│   ├── server.ts   # HTTP API (Hono)
│   └── cli.ts      # `rein register` command for coding agents
├── supabase/
│   └── migrations/
│       └── 001_agent_commits.sql
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

| File | Responsibility |
|---|---|
| `types.ts` | Core types and ID format. Start here when adding new agent commit fields. |
| `db.ts` | Supabase persistence via clients from `@supabase/server` context. |
| `git.ts` | Local git introspection (HEAD, origin remote normalization). |
| `server.ts` | REST API (Hono + `@supabase/server/adapters/hono`). |
| `cli.ts` | What coding agents call after `git commit`. |
| `supabase/migrations/` | SQL migrations to run against your Supabase project. |

---

## Querying agent commits (for downstream agents)

Other agents that need context about a commit should query Rein, not scrape git logs.

**By git SHA** (most common — you know the commit you're looking at):

```bash
curl -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  http://localhost:3000/agent-commits/by-sha/abc123...
```

**By agent commit ID**:

```bash
curl -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  http://localhost:3000/agent-commits/rein:abc123...
```

**All commits in a repo**:

```bash
curl -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  http://localhost:3000/repos/victoriamazilu%2Frein/agent-commits
```

If no agent commit exists for a git SHA, the API returns `404`. That means the commit was never registered — either it predates Rein, or the coding agent skipped `rein register`.

---

## What's not built yet

The current schema has only the minimum fields (`id`, `git_sha`, `repo`, `created_at`). Planned but not implemented:

- **Additional agent commit fields** — reasoning, tool calls, parent agent session, diff summary, etc. (TBD)
- **Auto-registration** — post-commit git hook so agents don't have to remember the CLI call
- **GitHub webhook fallback** — for commits that land without agent registration
- **Row Level Security policies** — reads with publishable key use RLS-scoped `ctx.supabase`; add policies before exposing reads publicly

When adding fields, update in this order: `types.ts` → `supabase/migrations/` (new migration) → `db.ts` → `server.ts` (API) → `cli.ts` (if the agent sends them at registration time).

---

## Conventions

- **Prefix is always `rein:`** — defined in `AGENT_COMMIT_PREFIX` in `src/types.ts`.
- **Repo format is `owner/repo`** — normalized from GitHub origin URLs in `src/git.ts`.
- **ESM + TypeScript** — `"type": "module"`, compile with `tsc`, run with `node dist/`.
- **Keep git and Rein separate** — never embed agent metadata in git commit messages or git objects. Rein owns its own database.
- **1:1 is invariant** — one agent commit per git commit. Do not support many-to-one or one-to-many without revisiting the core design.
- **Never commit secrets** — `.env` is gitignored; use `.env.example` as the template.

---

## Quick reference for agents

```
After every git commit:
  rein register          # or: npm run cli -- register

Before querying another commit's context:
  GET /agent-commits/by-sha/:sha

Agent commit ID format:
  rein:<full-git-sha>

If register fails:
  - Is the API running? (npm run dev)
  - Is .env configured with Supabase credentials?
  - Has the migration been applied? (supabase/migrations/001_agent_commits.sql)
  - Are you in a git repo with a commit?
  - Does origin remote exist?
  - Is SUPABASE_SECRET_KEY set? (required for rein register)
```

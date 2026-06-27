# Agent Instructions

This repo uses Rein for semantic commit memory.

Git stores code history. Rein stores durable project memory for future agents.

## Before starting work

Before making code changes, search prior project memory:

```bash
rein search "<short description of the task>"
```

Read the relevant AgentCommit results and use them as project context.

Examples:

```bash
rein search "auth middleware"
rein search "how does password reset work"
rein search "Supabase vector search"
```

## After finishing work

Stage only the intended changes:

```bash
git add <files>
```

Then commit with Rein:

```bash
rein commit
```

Do not use plain `git commit` unless the user explicitly asks for it.

`rein commit` will:

1. inspect staged changes
2. distill the task into semantic memory
3. create a real git commit
4. store AgentCommit metadata in Supabase

## Inspecting existing memory

To show stored memory for a commit:

```bash
rein show <sha>
```

`rein show` also accepts refs such as:

```bash
rein show HEAD
```

## Important rules

- Run `rein search` before starting substantive work.
- Use `rein commit` after staging changes.
- Do not commit secrets or `.env` files.
- If `rein commit` creates a git commit but memory storage fails, check `.rein/pending/` for the recovery file.

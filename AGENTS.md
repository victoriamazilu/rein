# Agent Instructions

This repo uses AgentGit for semantic commit memory.

Git stores code history. AgentGit stores durable project memory for future agents.

## Before starting work

Before making code changes, search prior project memory:

```bash
agentgit search "<short description of the task>"
```

Read the relevant AgentCommit results and use them as project context.

Examples:

```bash
agentgit search "auth middleware"
agentgit search "how does password reset work"
agentgit search "Supabase vector search"
```

## After finishing work

Stage only the intended changes:

```bash
git add <files>
```

Then commit with AgentGit:

```bash
agentgit commit
```

Do not use plain `git commit` unless the user explicitly asks for it.

`agentgit commit` will:

1. inspect staged changes
2. distill the task into semantic memory
3. create a real git commit
4. store AgentCommit metadata in Supabase

## Inspecting existing memory

To show stored memory for a commit:

```bash
agentgit show <sha>
```

`agentgit show` also accepts refs such as:

```bash
agentgit show HEAD
```

## Important rules

- Run `agentgit search` before starting substantive work.
- Use `agentgit commit` after staging changes.
- Do not commit secrets or `.env` files.
- If `agentgit commit` creates a git commit but memory storage fails, check `.agentgit/pending/` for the recovery file.

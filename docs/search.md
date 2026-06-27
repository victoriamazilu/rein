# Search tips

AgentGit uses hybrid search over stored commit memory:

- **Vector similarity** — `VECTOR_SEARCH_WEIGHT` (default 0.65)
- **Keyword rank** — `KEYWORD_SEARCH_WEIGHT` (default 0.35)

Weights and limits live in `src/constants.ts` (`DEFAULT_SEARCH_COUNT`, `MAX_SEARCH_COUNT`, `EMBEDDING_DIMENSIONS`).

## Examples

```bash
agentgit search "database migration"
agentgit search "gitignore sensitive files"
agentgit search "embedding supabase"
agentgit search "hybrid search weights" -n 5
```

## Troubleshooting

If search returns nothing after a schema change, run:

```bash
npm run db:migrate
```

Short queries like `env` rely on vector similarity; use longer phrases when possible.

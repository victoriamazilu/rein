# Search tips

AgentGit uses hybrid search: vector similarity (65%) + keyword rank (35%).

## Examples

```bash
agentgit search "database migration"
agentgit search "gitignore sensitive files"
agentgit search "embedding supabase"
```

## Troubleshooting

If search returns nothing after a schema change, run:

```bash
npm run db:migrate
```

Short queries like `env` rely on vector similarity; use longer phrases when possible.

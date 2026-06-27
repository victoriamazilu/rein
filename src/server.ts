import "dotenv/config";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { serve } from "@hono/node-server";
import { AuthError, type SupabaseContext } from "@supabase/server";
import { withSupabase } from "@supabase/server/adapters/hono";
import { AgentCommitStore } from "./db.js";

type Env = {
  Variables: {
    supabaseContext: SupabaseContext;
  };
};

const PORT = Number(process.env.PORT ?? 3000);
const app = new Hono<Env>();

function store(ctx: SupabaseContext): AgentCommitStore {
  const client =
    ctx.authMode === "secret" ? ctx.supabaseAdmin : ctx.supabase;
  return new AgentCommitStore(client);
}

app.onError((err, c) => {
  if (err instanceof HTTPException && err.cause instanceof AuthError) {
    const authError = err.cause;
    return c.json(
      { error: authError.message, code: authError.code },
      authError.status as 401 | 500
    );
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/health", withSupabase({ auth: "none" }), (c) =>
  c.json({ status: "ok" })
);

app.post(
  "/agent_commits",
  withSupabase({ auth: "secret" }),
  async (c) => {
    const ctx = c.var.supabaseContext;
    const body = await c.req.json<{ git_sha: string; repo: string }>();

    if (!body.git_sha || !body.repo) {
      return c.json({ error: "git_sha and repo are required" }, 400);
    }

    const agentStore = new AgentCommitStore(ctx.supabaseAdmin);
    const existing = await agentStore.getBySha(body.git_sha);
    if (existing) {
      return c.json(existing, 200);
    }

    try {
      const agentCommit = await agentStore.create(body.git_sha, body.repo);
      return c.json(agentCommit, 201);
    } catch (err) {
      console.error("Failed to create agent commit:", err);
      return c.json({ error: "failed to create agent commit" }, 500);
    }
  }
);

app.get(
  "/agent_commits/:id",
  withSupabase({ auth: ["publishable", "secret"] }),
  async (c) => {
    const ctx = c.var.supabaseContext;
    const id = c.req.param("id");
    const agentCommit = await store(ctx).getById(id);
    if (!agentCommit) return c.json({ error: "not found" }, 404);
    return c.json(agentCommit);
  }
);

app.get(
  "/agent_commits/by-sha/:sha",
  withSupabase({ auth: ["publishable", "secret"] }),
  async (c) => {
    const ctx = c.var.supabaseContext;
    const sha = c.req.param("sha");
    const agentCommit = await store(ctx).getBySha(sha);
    if (!agentCommit) return c.json({ error: "not found" }, 404);
    return c.json(agentCommit);
  }
);

app.get(
  "/repos/:repo/agent_commits",
  withSupabase({ auth: ["publishable", "secret"] }),
  async (c) => {
    const ctx = c.var.supabaseContext;
    const repo = decodeURIComponent(c.req.param("repo"));
    const agent_commits = await store(ctx).listByRepo(repo);
    return c.json(agent_commits);
  }
);

console.log(`Rein API listening on http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });

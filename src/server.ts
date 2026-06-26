import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { AgentCommitStore } from "./db.js";
import { agentCommitId } from "./types.js";

const DB_PATH = process.env.REIN_DB_PATH ?? "rein.db";
const PORT = Number(process.env.PORT ?? 3000);

const store = new AgentCommitStore(DB_PATH);
const app = new Hono();

app.post("/agent-commits", async (c) => {
  const body = await c.req.json<{ git_sha: string; repo: string }>();

  if (!body.git_sha || !body.repo) {
    return c.json({ error: "git_sha and repo are required" }, 400);
  }

  const existing = store.getBySha(body.git_sha);
  if (existing) {
    return c.json(existing, 200);
  }

  const agentCommit = store.create(body.git_sha, body.repo);
  return c.json(agentCommit, 201);
});

app.get("/agent-commits/:id", (c) => {
  const id = c.req.param("id");
  const agentCommit = store.getById(id);
  if (!agentCommit) return c.json({ error: "not found" }, 404);
  return c.json(agentCommit);
});

app.get("/agent-commits/by-sha/:sha", (c) => {
  const sha = c.req.param("sha");
  const agentCommit = store.getBySha(sha);
  if (!agentCommit) return c.json({ error: "not found" }, 404);
  return c.json(agentCommit);
});

app.get("/repos/:repo/agent-commits", (c) => {
  const repo = decodeURIComponent(c.req.param("repo"));
  return c.json(store.listByRepo(repo));
});

console.log(`Rein API listening on http://localhost:${PORT}`);
console.log(`Database: ${DB_PATH}`);

serve({ fetch: app.fetch, port: PORT });

process.on("SIGINT", () => {
  store.close();
  process.exit(0);
});

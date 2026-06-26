import { DatabaseSync } from "node:sqlite";
import { agentCommitId, type AgentCommit } from "./types.js";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS agent_commits (
    id         TEXT PRIMARY KEY,
    git_sha    TEXT NOT NULL UNIQUE,
    repo       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agent_commits_repo ON agent_commits(repo);
  CREATE INDEX IF NOT EXISTS idx_agent_commits_git_sha ON agent_commits(git_sha);
`;

export class AgentCommitStore {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
  }

  create(gitSha: string, repo: string): AgentCommit {
    const id = agentCommitId(gitSha);
    this.db
      .prepare(
        `INSERT INTO agent_commits (id, git_sha, repo) VALUES (?, ?, ?)`
      )
      .run(id, gitSha, repo);
    return this.getBySha(gitSha)!;
  }

  getById(id: string): AgentCommit | null {
    return (
      (this.db
        .prepare(`SELECT * FROM agent_commits WHERE id = ?`)
        .get(id) as AgentCommit | undefined) ?? null
    );
  }

  getBySha(gitSha: string): AgentCommit | null {
    return (
      (this.db
        .prepare(`SELECT * FROM agent_commits WHERE git_sha = ?`)
        .get(gitSha) as AgentCommit | undefined) ?? null
    );
  }

  listByRepo(repo: string): AgentCommit[] {
    return this.db
      .prepare(
        `SELECT * FROM agent_commits WHERE repo = ? ORDER BY created_at DESC`
      )
      .all(repo) as unknown as AgentCommit[];
  }

  close(): void {
    this.db.close();
  }
}

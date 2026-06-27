import type { Commit } from "@/lib/types";

export function CommitMemoryList({ commits }: { commits: Commit[] }) {
  if (commits.length === 0) {
    return (
      <div className="empty-state">
        <p>No commits with agent memory yet.</p>
        <p className="muted">
          Clone this repo locally, then run <code>agentgit backfill</code>.
        </p>
      </div>
    );
  }

  return (
    <ul className="commit-memory-list">
      {commits.map((commit) => (
        <li className="commit-memory-item" key={commit.sha}>
          <div className="commit-memory-git">
            <div className="commit-memory-head">
              <code>{commit.sha}</code>
              <span className="commit-message">{commit.message}</span>
            </div>
            <p className="muted">
              {commit.author} · {commit.relativeTime}
            </p>
          </div>

          {commit.memory ? (
            <div className="commit-memory-agent">
              <span className="memory-label">agent_commits</span>
              <h3>{commit.memory.title}</h3>
              <p>{commit.memory.intent}</p>
              <blockquote>{commit.memory.notes}</blockquote>
            </div>
          ) : (
            <div className="commit-memory-empty">
              <span className="muted">No agent memory stored</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

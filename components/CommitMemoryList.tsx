import type { Commit } from "@/lib/types";

export function CommitMemoryList({ commits }: { commits: Commit[] }) {
  if (commits.length === 0) {
    return (
      <div className="empty-state">
        <p className="muted">No commits yet.</p>
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
        </li>
      ))}
    </ul>
  );
}

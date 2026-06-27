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
            <div className="commit-intel-row">
              {commit.branch ? <span>{commit.branch}</span> : null}
              {commit.category ? <span>{commit.category}</span> : null}
              {commit.pullRequest ? <span>PR #{commit.pullRequest}</span> : null}
              {commit.issue ? <span>Issue #{commit.issue}</span> : null}
              {typeof commit.risk === "number" ? <span>risk {commit.risk.toFixed(2)}</span> : null}
              {typeof commit.confidence === "number" ? (
                <span>confidence {commit.confidence.toFixed(2)}</span>
              ) : null}
            </div>
            {commit.affectedFiles && commit.affectedFiles.length > 0 ? (
              <p className="commit-files muted">
                {commit.affectedFiles
                  .slice(0, 3)
                  .map((file) => `${file.path} (${file.changeType})`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>

          {commit.memory ? (
            <div className="commit-memory-agent">
              <span className="memory-label">agent_commits</span>
              <h3>{commit.memory.title}</h3>
              <div className="commit-intel-row">
                {commit.memory.impact ? <span>{commit.memory.impact} impact</span> : null}
                {commit.memory.owner ? <span>owner {commit.memory.owner}</span> : null}
                {commit.memory.modules?.slice(0, 3).map((module) => (
                  <span key={`${commit.sha}-${module}`}>{module}</span>
                ))}
              </div>
              <p>{commit.memory.intent}</p>
              <blockquote>{commit.memory.notes}</blockquote>
              {commit.memory.related && commit.memory.related.length > 0 ? (
                <div className="commit-related-graph">
                  <span>semantic graph links</span>
                  <ul>
                    {commit.memory.related.map((related) => (
                      <li key={`${commit.sha}-${related.sha}`}>
                        <code>{related.sha}</code>
                        <span>{related.title}</span>
                        <strong>{related.similarity.toFixed(3)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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

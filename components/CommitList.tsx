import type { Commit } from "@/lib/mockData";

export function CommitList({ commits }: { commits: Commit[] }) {
  return (
    <ol className="commit-list">
      {commits.map((commit) => (
        <li className="commit-item" key={commit.sha}>
          <div>
            <h3>{commit.message}</h3>
            <p>
              {commit.author} committed <code>{commit.sha}</code>
            </p>
          </div>
          <time dateTime={commit.timestamp}>{commit.relativeTime}</time>
        </li>
      ))}
    </ol>
  );
}

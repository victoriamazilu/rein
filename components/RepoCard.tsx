import Link from "next/link";
import type { Repository } from "@/lib/mockData";

export function RepoCard({ repo }: { repo: Repository }) {
  return (
    <Link className="repo-card" href={`/repo/${repo.name}`}>
      <div>
        <p className="eyebrow">{repo.language}</p>
        <h3>{repo.name}</h3>
      </div>
      <p>{repo.description}</p>
      <small>Updated {repo.lastUpdatedLabel}</small>
    </Link>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddRepositoryButton } from "@/components/AddRepositoryDialog";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PageHeader, StatPill } from "@/components/ui";
import type { RepositorySummary, WorkspaceRepo } from "@/lib/types";
import { repoKey, repoPath } from "@/lib/types";
import { listWorkspaceReposForOrg } from "@/lib/workspace";

function RepoListItem({
  repo,
  summary,
}: {
  repo: WorkspaceRepo;
  summary: RepositorySummary | null;
}) {
  return (
    <li>
      <article className="repo-list-item">
        <div className="repo-list-primary">
          <Link className="repo-list-name" href={repoPath(repo.org, repo.name)}>
            {repo.org}/<strong>{repo.name}</strong>
          </Link>
        </div>
        <div className="repo-list-meta">
          {summary ? (
            <>
              <span className="muted">{summary.language}</span>
              <span className="muted">{summary.commitCount} commits</span>
              <span className="muted">{summary.memoryCount} with memory</span>
              <span className="muted">Updated {summary.lastUpdatedLabel}</span>
            </>
          ) : (
            <span className="muted">Loading metadata</span>
          )}
        </div>
      </article>
    </li>
  );
}

export function OrgView({ orgSlug }: { orgSlug: string }) {
  const { repos, ready } = useWorkspace();
  const workspaceRepos = ready ? listWorkspaceReposForOrg(repos, orgSlug) : [];
  const repoKeys = workspaceRepos.map((repo) => repoKey(repo.org, repo.name)).join("|");
  const [summaries, setSummaries] = useState<Map<string, RepositorySummary>>(new Map());

  useEffect(() => {
    if (!ready || workspaceRepos.length === 0) return;

    for (const repo of workspaceRepos) {
      const key = repoKey(repo.org, repo.name);

      fetch(`/api/repos/${encodeURIComponent(repo.org)}/${encodeURIComponent(repo.name)}?summary=1`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) return;
          setSummaries((prev) => new Map(prev).set(key, data as RepositorySummary));
        });
    }
  }, [ready, repoKeys]);

  if (!ready) {
    return <p className="muted">Loading workspace…</p>;
  }

  if (workspaceRepos.length === 0) notFound();

  const totalMemory = [...summaries.values()].reduce((sum, item) => sum + item.memoryCount, 0);

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: "Organizations", href: "/" }, { label: orgSlug }]}
        title={
          <span className="title-with-avatar">
            <span className="org-card-avatar">{orgSlug.slice(0, 1).toUpperCase()}</span>
            {orgSlug}
          </span>
        }
        description="Workspace repositories with GitHub stats and AgentGit memory."
        meta={
          <>
            <StatPill label="repositories" value={workspaceRepos.length} />
            <StatPill label="with memory" value={totalMemory} />
          </>
        }
        actions={<AddRepositoryButton defaultOrg={orgSlug} label="Add repository" />}
      />

      <section className="panel">
        <div className="panel-header">
          <h2>Repositories</h2>
        </div>
        <ul className="repo-list">
          {workspaceRepos.map((repo) => {
            const key = repoKey(repo.org, repo.name);
            return (
              <RepoListItem
                key={key}
                repo={repo}
                summary={summaries.get(key) ?? null}
              />
            );
          })}
        </ul>
      </section>
    </div>
  );
}

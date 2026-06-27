"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useState } from "react";
import { CommitMemoryList } from "@/components/CommitMemoryList";
import { MemoryGraphPanel } from "@/components/MemoryGraphPanel";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PageHeader, StatPill } from "@/components/ui";
import { useRepositoryData } from "@/hooks/useRepositoryData";
import { getWorkspaceRepo, listWorkspaceReposForOrg } from "@/lib/workspace";
import { orgPath } from "@/lib/types";

const INITIAL_COMMIT_COUNT = 5;

export function RepoView({ orgSlug, repoName }: { orgSlug: string; repoName: string }) {
  const router = useRouter();
  const { repos, ready, removeRepository } = useWorkspace();
  const { loading, error, summary, commits } = useRepositoryData(orgSlug, repoName);
  const [showAllCommits, setShowAllCommits] = useState(false);

  if (!ready) {
    return <p className="muted">Loading…</p>;
  }

  const workspaceRepo = getWorkspaceRepo(repos, orgSlug, repoName);
  if (!workspaceRepo) notFound();

  const orgRepos = listWorkspaceReposForOrg(repos, orgSlug);
  const visibleCommits = showAllCommits ? commits : commits.slice(0, INITIAL_COMMIT_COUNT);
  const hiddenCommitCount = Math.max(commits.length - INITIAL_COMMIT_COUNT, 0);
  const memoryCoverage =
    summary && summary.commitCount > 0
      ? Math.round(
          (Math.min(summary.memoryCount, summary.commitCount) / summary.commitCount) * 100
        )
      : 0;

  return (
    <div className="page repo-page">
      <PageHeader
        breadcrumbs={[
          { label: "Organizations", href: "/" },
          { label: orgSlug, href: orgPath(orgSlug) },
          { label: repoName },
        ]}
        title={
          <span className="repo-title">
            {orgSlug}/<strong>{repoName}</strong>
          </span>
        }
        meta={
          summary ? (
            <>
              <StatPill label="commits" value={summary.commitCount} />
              <StatPill
                label="in memory"
                value={`${memoryCoverage}%`}
                complete={memoryCoverage >= 100}
              />
            </>
          ) : null
        }
        actions={
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              if (confirm(`Remove ${orgSlug}/${repoName} from workspace?`)) {
                removeRepository(orgSlug, repoName);
                router.push(orgPath(orgSlug));
              }
            }}
          >
            Remove
          </button>
        }
      />

      {error ? (
        <section className="panel empty-panel">
          <p className="form-error">{error}</p>
        </section>
      ) : null}

      <div className="repo-layout">
        <aside className="repo-sidebar" aria-label="Repository navigation">
          <nav className="repo-sidebar-nav">
            <span className="repo-sidebar-heading">{orgSlug}</span>
            {orgRepos.map((item) => (
              <Link
                href={`/${item.org}/${item.name}`}
                key={item.name}
                className={item.name === repoName ? "is-active" : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="repo-main">
          <MemoryGraphPanel org={orgSlug} name={repoName} />

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Changes</h2>
                <p className="panel-header-desc muted">
                  Agent-distilled summaries instead of raw diffs.
                </p>
              </div>
            </div>
            {loading ? (
              <p className="empty-state muted">Loading…</p>
            ) : (
              <>
                <CommitMemoryList commits={visibleCommits} org={orgSlug} repo={repoName} />
                {!showAllCommits && hiddenCommitCount > 0 ? (
                  <div className="panel-footer">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setShowAllCommits(true)}
                    >
                      See more ({hiddenCommitCount})
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { CommitMemoryList } from "@/components/CommitMemoryList";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PageHeader, StatPill } from "@/components/ui";
import { useRepositoryData } from "@/hooks/useRepositoryData";
import { getWorkspaceRepo, listWorkspaceReposForOrg } from "@/lib/workspace";
import { orgPath } from "@/lib/types";

export function RepoView({ orgSlug, repoName }: { orgSlug: string; repoName: string }) {
  const router = useRouter();
  const { repos, ready, removeRepository } = useWorkspace();
  const { loading, error, summary, commits } = useRepositoryData(orgSlug, repoName);

  if (!ready) {
    return <p className="muted">Loading workspace…</p>;
  }

  const workspaceRepo = getWorkspaceRepo(repos, orgSlug, repoName);
  if (!workspaceRepo) notFound();

  const orgRepos = listWorkspaceReposForOrg(repos, orgSlug);

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
        description={
          loading ? "Loading from GitHub…" : (summary?.description ?? workspaceRepo.url)
        }
        meta={
          summary ? (
            <>
              <StatPill label="commits" value={summary.commitCount} />
              <StatPill label="agent memory" value={summary.memoryCount} />
              <span className="muted">{summary.language}</span>
              <span className="muted mono">{workspaceRepo.url}</span>
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
          <section className="panel">
            <div className="panel-header">
              <h2>Overview</h2>
            </div>
            <dl className="overview-grid">
              <div>
                <dt>Clone URL</dt>
                <dd className="mono">{workspaceRepo.url}</dd>
              </div>
              <div>
                <dt>Default branch</dt>
                <dd>{loading ? "…" : (summary?.defaultBranch ?? "—")}</dd>
              </div>
              <div>
                <dt>Total commits</dt>
                <dd>{loading ? "…" : (summary?.commitCount ?? "—")}</dd>
              </div>
              <div>
                <dt>Memory coverage</dt>
                <dd>
                  {loading
                    ? "…"
                    : `${summary?.memoryCount ?? 0} / ${summary?.commitCount ?? "—"} commits`}
                </dd>
              </div>
              <div>
                <dt>Last push</dt>
                <dd>{loading ? "…" : (summary?.lastUpdatedLabel ?? "—")}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{loading ? "…" : (summary?.language ?? "—")}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Commits</h2>
              <span className="muted">
                {loading
                  ? "Loading…"
                  : `Recent from GitHub${summary ? ` · showing ${commits.length} of ${summary.commitCount}` : ""}`}
              </span>
            </div>
            {loading ? (
              <p className="empty-state muted">Fetching commit history…</p>
            ) : (
              <CommitMemoryList commits={commits} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

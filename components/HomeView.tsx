"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddRepositoryButton } from "@/components/AddRepositoryDialog";
import { useWorkspace } from "@/components/WorkspaceProvider";
import type { Commit, RepositorySummary, WorkspaceRepo } from "@/lib/types";
import { orgPath, repoKey, repoPath } from "@/lib/types";
import { listOrganizations } from "@/lib/workspace";

type RepositoryData = RepositorySummary & { commits: Commit[] };
type WorkspaceRow = WorkspaceRepo & { data?: RepositoryData };

function includesQuery(row: WorkspaceRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.org,
    row.name,
    row.url,
    row.data?.description,
    row.data?.language,
    ...(row.data?.commits.flatMap((commit) => [
      commit.message,
      commit.author,
      commit.memory?.title,
      commit.memory?.intent,
    ]) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function buildAgentAnswer(query: string, rows: WorkspaceRow[]) {
  const allRows = rows.filter((row) => row.data);
  if (allRows.length === 0) return "Loading repository data before answering.";

  const normalized = query.trim().toLowerCase();
  const matchingCommits = allRows.flatMap((row) =>
    (row.data?.commits ?? [])
      .filter((commit) => {
        if (!normalized) return Boolean(commit.memory);
        return [
          row.org,
          row.name,
          commit.message,
          commit.author,
          commit.memory?.title,
          commit.memory?.intent,
          commit.memory?.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      })
      .map((commit) => ({ row, commit }))
  );

  if (normalized.includes("backfill") || normalized.includes("gap")) {
    const gaps = allRows
      .map((row) => {
        const commitCount = row.data?.commitCount ?? 0;
        const memoryCount = row.data?.memoryCount ?? 0;
        return { key: `${row.org}/${row.name}`, gap: commitCount - memoryCount, commitCount };
      })
      .filter((item) => item.gap > 0)
      .sort((a, b) => b.gap - a.gap);

    if (gaps.length === 0) return "All seeded repositories have full memory coverage.";
    const top = gaps[0];
    return `${top.key} has the largest memory gap with ${top.gap} of ${top.commitCount} commits missing memory. Next: ${gaps
      .slice(1, 3)
      .map((item) => `${item.key} (${item.gap})`)
      .join(", ") || "no other gaps"}.`;
  }

  if (matchingCommits.length > 0) {
    const best = matchingCommits[0];
    const title = best.commit.memory?.title ?? best.commit.message;
    const intent = best.commit.memory?.intent ?? "This commit has no stored agent memory yet.";
    return `${best.row.org}/${best.row.name}: ${title}. ${intent}`;
  }

  const totalCommits = allRows.reduce((sum, row) => sum + (row.data?.commitCount ?? 0), 0);
  const totalMemory = allRows.reduce((sum, row) => sum + (row.data?.memoryCount ?? 0), 0);
  return `The seeded workspace has ${allRows.length} repositories, ${totalCommits} commits, and ${totalMemory} agent memories. Try asking about coverage, backfill, releases, evaluations, or search.`;
}

export function HomeView() {
  const { repos, ready } = useWorkspace();
  const [repoQuery, setRepoQuery] = useState("");
  const [askQuery, setAskQuery] = useState("Which repositories need memory backfill?");
  const [answer, setAnswer] = useState("");
  const [scope, setScope] = useState<"visible" | "all">("all");
  const [repoData, setRepoData] = useState<Record<string, RepositoryData>>({});
  const organizations = listOrganizations(repos);
  const rows = useMemo<WorkspaceRow[]>(
    () => repos.map((repo) => ({ ...repo, data: repoData[repoKey(repo.org, repo.name)] })),
    [repoData, repos]
  );
  const visibleRows = rows.filter((row) => includesQuery(row, repoQuery));
  const topRepos = visibleRows.slice(0, 8);
  const loadedRows = rows.filter((row) => row.data);
  const totalCommits = loadedRows.reduce((sum, row) => sum + (row.data?.commitCount ?? 0), 0);
  const totalMemory = loadedRows.reduce((sum, row) => sum + (row.data?.memoryCount ?? 0), 0);
  const languageCount = new Set(loadedRows.map((row) => row.data?.language).filter(Boolean)).size;
  const changelog = loadedRows
    .flatMap((row) =>
      (row.data?.commits ?? []).map((commit) => ({
        repo: `${row.org}/${row.name}`,
        commit,
      }))
    )
    .sort((a, b) => b.commit.timestamp.localeCompare(a.commit.timestamp))
    .slice(0, 4);

  useEffect(() => {
    if (!ready || repos.length === 0) return;
    let cancelled = false;

    async function loadSummaries() {
      const entries = await Promise.all(
        repos.map(async (repo) => {
          const key = repoKey(repo.org, repo.name);
          const res = await fetch(`/api/repos/${encodeURIComponent(repo.org)}/${encodeURIComponent(repo.name)}`);
          if (!res.ok) return [key, null] as const;
          return [key, (await res.json()) as RepositoryData] as const;
        })
      );

      if (!cancelled) {
        setRepoData((prev) => {
          const next = { ...prev };
          for (const [key, data] of entries) {
            if (data) next[key] = data;
          }
          return next;
        });
      }
    }

    loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [ready, repos]);

  if (!ready) {
    return <p className="muted">Loading workspace…</p>;
  }

  return (
    <div className="home-dashboard">
      <aside className="home-sidebar" aria-label="Repositories">
        <div className="home-sidebar-header">
          <h2>Top repositories</h2>
          <AddRepositoryButton label="New" />
        </div>
        <label className="home-repo-search">
          <span className="sr-only">Find a repository</span>
          <input
            type="search"
            placeholder="Find repository"
            value={repoQuery}
            onChange={(event) => setRepoQuery(event.target.value)}
          />
        </label>

        {topRepos.length > 0 ? (
          <ul className="home-repo-list">
            {topRepos.map((repo) => (
              <li key={`${repo.org}/${repo.name}`}>
                <Link href={repoPath(repo.org, repo.name)}>
                  <span className="home-repo-avatar">{repo.org.slice(0, 1).toUpperCase()}</span>
                  <span>
                    {repo.org}/<strong>{repo.name}</strong>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="home-sidebar-empty">
            <p>No repositories yet.</p>
            <p className="muted">Add a URL or owner/repo.</p>
          </div>
        )}

        {organizations.length > 0 ? (
          <div className="home-orgs">
            <h3>Organizations</h3>
            {organizations.map((org) => (
              <Link href={orgPath(org.slug)} key={org.slug}>
                <span className="home-repo-avatar">{org.slug.slice(0, 1).toUpperCase()}</span>
                <span>{org.name}</span>
                <span className="muted">{org.repoCount}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </aside>

      <main className="home-main">
        <section className="home-ask-panel" aria-label="Ask agents">
          <h1>Home</h1>
          <div className="ask-box">
            <form
              className="ask-form"
              onSubmit={(event) => {
                event.preventDefault();
                setAnswer(buildAgentAnswer(askQuery, scope === "all" ? rows : visibleRows));
              }}
            >
              <label className="ask-input-label">
                <span className="ask-input-heading">Ask about your workspace</span>
                <input
                  type="text"
                  value={askQuery}
                  onChange={(event) => setAskQuery(event.target.value)}
                  placeholder="Coverage, releases, backfill gaps…"
                />
              </label>
              {answer ? <p className="ask-answer">{answer}</p> : null}
              <div className="ask-controls">
                <button type="submit" className="button-secondary">
                  Ask
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    const nextScope = scope === "all" ? "visible" : "all";
                    setScope(nextScope);
                    setAnswer(buildAgentAnswer(askQuery, nextScope === "all" ? rows : visibleRows));
                  }}
                >
                  {scope === "all" ? "All repositories" : "Visible repositories"}
                </button>
              </div>
            </form>

            <div className="workspace-kpis" aria-label="Workspace metrics">
              <div className="workspace-kpi-row">
                <span className="workspace-kpi-label">Repositories</span>
                <strong className="workspace-kpi-value">{repos.length}</strong>
              </div>
              <div className="workspace-kpi-row">
                <span className="workspace-kpi-label">Commits</span>
                <strong className="workspace-kpi-value">{totalCommits.toLocaleString()}</strong>
              </div>
              <div className="workspace-kpi-row">
                <span className="workspace-kpi-label">Memories</span>
                <strong className="workspace-kpi-value">{totalMemory.toLocaleString()}</strong>
              </div>
              <div className="workspace-kpi-row">
                <span className="workspace-kpi-label">Languages</span>
                <strong className="workspace-kpi-value">{languageCount}</strong>
              </div>
            </div>

            <div className="ask-box-footer">
              <AddRepositoryButton label="Add repository" />
            </div>
          </div>
        </section>
      </main>

      <aside className="home-right-rail" aria-label="Updates">
        <section className="promo-card">
          <span className="badge badge-public">New</span>
          <h2>Commit memory</h2>
          <p>Decisions, intent, and notes for the next agent.</p>
          <AddRepositoryButton label="Connect a repo" />
        </section>

        <section className="changelog-card">
          <h2>Latest from Rein</h2>
          <ol>
            {changelog.map(({ repo, commit }) => (
              <li key={`${repo}/${commit.sha}`}>
                <span className="muted">
                  {repo} · {commit.relativeTime}
                </span>
                <strong>{commit.memory?.title ?? commit.message}</strong>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

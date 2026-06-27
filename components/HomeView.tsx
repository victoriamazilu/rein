"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddRepositoryButton } from "@/components/AddRepositoryDialog";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { LanguageDot } from "@/components/ui";
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
  const [languageFilter, setLanguageFilter] = useState("All");
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [repoData, setRepoData] = useState<Record<string, RepositoryData>>({});
  const organizations = listOrganizations(repos);
  const rows = useMemo<WorkspaceRow[]>(
    () => repos.map((repo) => ({ ...repo, data: repoData[repoKey(repo.org, repo.name)] })),
    [repoData, repos]
  );
  const visibleRows = rows.filter((row) => includesQuery(row, repoQuery));
  const topRepos = visibleRows.slice(0, 8);
  const repoCount = visibleRows.length;
  const loadedRows = rows.filter((row) => row.data);
  const totalCommits = loadedRows.reduce((sum, row) => sum + (row.data?.commitCount ?? 0), 0);
  const totalMemory = loadedRows.reduce((sum, row) => sum + (row.data?.memoryCount ?? 0), 0);
  const languages = ["All", ...Array.from(new Set(loadedRows.map((row) => row.data?.language).filter(Boolean)))];
  const trendingRows = loadedRows
    .filter((row) => languageFilter === "All" || row.data?.language === languageFilter)
    .sort((a, b) => {
      const aScore = (a.data?.memoryCount ?? 0) * 2 + (a.data?.commitCount ?? 0);
      const bScore = (b.data?.memoryCount ?? 0) * 2 + (b.data?.commitCount ?? 0);
      return bScore - aScore;
    });
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
              <label>
                <span className="sr-only">Ask about workspace memory</span>
                <input
                  type="text"
                  value={askQuery}
                  onChange={(event) => setAskQuery(event.target.value)}
                  placeholder="Ask about coverage, releases, or backfill"
                />
              </label>
              {answer ? <p className="ask-answer">{answer}</p> : null}
              <div className="ask-controls">
                <button type="submit" className="button-secondary">Ask</button>
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
              <span><strong>{repos.length}</strong> repos</span>
              <span><strong>{totalCommits}</strong> commits</span>
              <span><strong>{totalMemory}</strong> memories</span>
              <span><strong>{languages.length - 1}</strong> languages</span>
            </div>
            <div className="ask-controls">
              <AddRepositoryButton label="Add repository" />
            </div>
          </div>
        </section>

        <section className="trending-section">
          <div className="section-heading-row">
            <div>
              <h2>Trending repositories</h2>
              <p className="muted">High-signal repos by activity and memory.</p>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                const current = languages.indexOf(languageFilter);
                setLanguageFilter(languages[(current + 1) % languages.length] ?? "All");
              }}
            >
              {languageFilter === "All" ? "Filter" : languageFilter}
            </button>
          </div>

          <div className="trending-list">
            {trendingRows.map((repo) => {
              const key = repoKey(repo.org, repo.name);
              const coverage = repo.data?.commitCount
                ? Math.round(((repo.data?.memoryCount ?? 0) / repo.data.commitCount) * 100)
                : 0;

              return (
              <article className="trending-card" key={key}>
                <div>
                  <h3>
                    <Link href={repoPath(repo.org, repo.name)}>
                      {repo.org}/{repo.name}
                    </Link>
                  </h3>
                  <div className="repo-list-meta">
                    <LanguageDot language={repo.data?.language ?? "—"} />
                    <span className="muted">{repo.data?.commitCount ?? 0} commits</span>
                    <span className="muted">{coverage}% memory</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`button-secondary star-button${starred.has(key) ? " is-starred" : ""}`}
                  aria-label={`Star ${repo.org}/${repo.name}`}
                  aria-pressed={starred.has(key)}
                  onClick={() =>
                    setStarred((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                >
                  {starred.has(key) ? "★" : "☆"}
                </button>
              </article>
              );
            })}
          </div>
        </section>

        <section className="workspace-summary panel">
          <div className="panel-header">
            <h2>Your workspace</h2>
            <span className="muted">{repoCount} repositories</span>
          </div>
          {repoCount > 0 ? (
            <ul className="workspace-mini-list">
              {visibleRows.slice(0, 5).map((repo) => (
                <li key={`${repo.org}/${repo.name}`}>
                  <Link href={repoPath(repo.org, repo.name)}>
                    {repo.org}/<strong>{repo.name}</strong>
                  </Link>
                  <span className="muted">
                    {repo.data
                      ? `${repo.data.language} · ${repo.data.commitCount} commits · ${repo.data.memoryCount} memories`
                      : "Loading metadata"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-panel">
              <p>No repositories yet.</p>
              <p className="muted">Paste a GitHub URL or owner/repo.</p>
            </div>
          )}
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
                <span className="muted">{repo} · {commit.relativeTime}</span>
                <strong>{commit.memory?.title ?? commit.message}</strong>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { listOrganizations } from "@/lib/workspace";
import { orgPath, repoPath } from "@/lib/types";

export function AppShell({ children }: { children: ReactNode }) {
  const { repos, ready } = useWorkspace();
  const [query, setQuery] = useState("");
  const organizations = ready ? listOrganizations(repos) : [];
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return repos
      .filter((repo) =>
        [repo.org, repo.name, repo.url].join(" ").toLowerCase().includes(normalized)
      )
      .slice(0, 6);
  }, [query, repos]);

  return (
    <div className="app-shell">
      <header className="global-header">
        <div className="global-header-inner">
          <div className="global-header-start">
            <Link href="/" className="brand" aria-label="Rein home">
              <span className="brand-mark" aria-hidden="true" />
              <span>Rein</span>
            </Link>
            <label className="search-shell">
              <span className="sr-only">Search repositories</span>
              <input
                type="search"
                placeholder="Type to search repositories"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <div className="search-results" role="listbox">
                  {searchResults.length > 0 ? (
                    searchResults.map((repo) => (
                      <Link
                        href={repoPath(repo.org, repo.name)}
                        key={`${repo.org}/${repo.name}`}
                        onClick={() => setQuery("")}
                      >
                        <span>
                          {repo.org}/<strong>{repo.name}</strong>
                        </span>
                        <span className="muted mono">{repo.url}</span>
                      </Link>
                    ))
                  ) : (
                    <span className="search-empty">No seeded repositories match.</span>
                  )}
                </div>
              ) : null}
            </label>
          </div>
          <nav className="global-header-end" aria-label="Account">
            <Link href="/" className="global-nav-link">
              Dashboard
            </Link>
            <Link href="/account" className="account-chip">
              <span className="account-avatar" aria-hidden="true">
                R
              </span>
              <span>Workspace</span>
            </Link>
          </nav>
        </div>
      </header>

      {organizations.length > 0 ? (
        <div className="subnav">
          <div className="subnav-inner">
            <span className="subnav-label">Organizations</span>
            {organizations.map((org) => (
              <Link href={orgPath(org.slug)} key={org.slug} className="subnav-link">
                {org.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <main className="main-content">{children}</main>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { githubUser, repositories } from "@/lib/mockData";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Rein repositories">
        <Link href="/" className="logo" aria-label="Rein home">
          <span className="logo-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>Rein</span>
        </Link>

        <nav className="repo-nav">
          <p className="nav-label">Repositories</p>
          {repositories.map((repo) => (
            <Link className="repo-nav-link" href={`/repo/${repo.name}`} key={repo.name}>
              <span>{repo.name}</span>
              <small>{repo.language}</small>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <Link href="/account" className="account-link">
            <img src={githubUser.avatarUrl} alt="" />
            <span>{githubUser.name}</span>
          </Link>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

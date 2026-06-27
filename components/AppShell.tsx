"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { listOrganizations } from "@/lib/workspace";
import { orgPath } from "@/lib/types";

export function AppShell({ children }: { children: ReactNode }) {
  const { repos, ready } = useWorkspace();
  const organizations = ready ? listOrganizations(repos) : [];

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
              <input type="search" placeholder="Search repositories…" disabled />
            </label>
          </div>
          <nav className="global-header-end" aria-label="Account">
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

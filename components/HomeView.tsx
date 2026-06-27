"use client";

import { OrgCard } from "@/components/OrgCard";
import { AddRepositoryButton } from "@/components/AddRepositoryDialog";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PageHeader } from "@/components/ui";
import { listOrganizations } from "@/lib/workspace";

export function HomeView() {
  const { repos, ready } = useWorkspace();
  const organizations = listOrganizations(repos);

  if (!ready) {
    return <p className="muted">Loading workspace…</p>;
  }

  if (organizations.length === 0) {
    return (
      <div className="page">
        <PageHeader
          title="Add a repository"
          description="Rein tracks semantic memory for git commits. Add any repo by URL — no GitHub account connection required."
          actions={<AddRepositoryButton />}
        />
        <section className="panel empty-panel">
          <p>No repositories yet.</p>
          <p className="muted">
            Paste a clone URL like <code>https://github.com/you/project.git</code> or{" "}
            <code>you/project</code>.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Your organizations"
        description="Repositories you added by URL, grouped by owner — same shape as GitHub, without the sync."
        actions={<AddRepositoryButton />}
      />

      <section className="panel">
        <div className="panel-header">
          <h2>Organizations</h2>
          <span className="muted">{organizations.length} total</span>
        </div>
        <div className="org-grid">
          {organizations.map((org) => (
            <OrgCard org={org} key={org.slug} />
          ))}
        </div>
      </section>
    </div>
  );
}

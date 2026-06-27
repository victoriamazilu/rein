"use client";

import { AddRepositoryButton } from "@/components/AddRepositoryDialog";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PageHeader, StatPill } from "@/components/ui";
import { listOrganizations } from "@/lib/workspace";

export function AccountView() {
  const { repos, ready } = useWorkspace();
  const organizations = listOrganizations(repos);

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: "Organizations", href: "/" }, { label: "Workspace" }]}
        title="Workspace"
        description="Local workspace preview. Repositories stay in your browser."
        actions={<AddRepositoryButton />}
        meta={
          ready ? (
            <>
              <StatPill label="organizations" value={organizations.length} />
              <StatPill label="repositories" value={repos.length} />
            </>
          ) : null
        }
      />

      <section className="panel">
        <div className="panel-header">
          <h2>Setup</h2>
        </div>
        <ol className="how-list">
          <li>Add a repository with a git clone URL.</li>
          <li>
            Clone it locally: <code>git clone &lt;url&gt;</code>
          </li>
          <li>
            Run <code>rein backfill</code> to populate agent_commits.
          </li>
        </ol>
      </section>
    </div>
  );
}

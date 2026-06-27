"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CommitMemoryList } from "@/components/CommitMemoryList";
import { MemoryGraphPanel } from "@/components/MemoryGraphPanel";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PageHeader, StatPill } from "@/components/ui";
import { useRepositoryData } from "@/hooks/useRepositoryData";
import { getWorkspaceRepo, listWorkspaceReposForOrg } from "@/lib/workspace";
import { orgPath, type SemanticCommitGraph } from "@/lib/types";

function shortGraphLabel(text: string, maxLength = 18) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function SemanticGraphView({ graph }: { graph: SemanticCommitGraph | null }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [edgeThreshold, setEdgeThreshold] = useState(graph?.threshold ?? 0.82);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="empty-state">
        <p>No seeded embeddings are available for this repository graph.</p>
      </div>
    );
  }

  const width = 760;
  const height = 360;
  const nodePositions = new Map(
    graph.nodes.map((node) => {
      return [
        node.id,
        {
          ...node,
          x: 56 + node.x * (width - 112),
          y: 42 + node.y * (height - 84),
        },
      ];
    })
  );
  const selectedNode = selectedNodeId
    ? nodePositions.get(selectedNodeId) ?? null
    : [...nodePositions.values()][0] ?? null;
  const visibleEdges = graph.edges.filter((edge) => edge.weight >= edgeThreshold);
  const relatedEdges = selectedNode
    ? visibleEdges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
    : [];
  const topics = Array.from(new Set(graph.nodes.map((node) => node.topic))).sort();

  return (
    <div className="semantic-graph-shell">
      <div className="semantic-graph-toolbar">
        <label>
          <span>Edge threshold</span>
          <input
            type="range"
            min="0.68"
            max="0.98"
            step="0.01"
            value={edgeThreshold}
            onChange={(event) => setEdgeThreshold(Number(event.target.value))}
          />
          <strong>{edgeThreshold.toFixed(2)}</strong>
        </label>
        <span className="muted">{visibleEdges.length} visible semantic edges</span>
      </div>

      <div className="semantic-graph-canvas" aria-label="Semantic embedding commit graph">
        <svg viewBox={`0 0 ${width} ${height}`} role="img">
          <title>Semantic Embedding Scatterplot</title>
          <desc>
            Commit memories are projected into two dimensions from seeded embeddings. Nearby points
            are semantically similar; optional edges show cosine similarity above the selected threshold.
          </desc>
          <g className="semantic-graph-grid" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((tick) => (
              <g key={tick}>
                <line x1={56 + tick * (width - 112)} y1="24" x2={56 + tick * (width - 112)} y2={height - 24} />
                <line x1="32" y1={42 + tick * (height - 84)} x2={width - 32} y2={42 + tick * (height - 84)} />
              </g>
            ))}
          </g>
          <text className="semantic-axis-label" x="54" y="24">feature / workspace</text>
          <text className="semantic-axis-label" x={width - 130} y={height - 18}>policy / release</text>
          {visibleEdges.map((edge) => {
            const from = nodePositions.get(edge.from);
            const to = nodePositions.get(edge.to);
            if (!from || !to) return null;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={Math.max(1.5, (edge.weight - graph.threshold) * 14)}
                />
                <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>
                  {edge.weight.toFixed(2)}
                </text>
              </g>
            );
          })}
          {[...nodePositions.values()].map((node) => (
            <g
              className={`semantic-graph-node topic-${node.topic}${node.id === selectedNode?.id ? " is-selected" : ""}`}
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              onClick={() => setSelectedNodeId(node.id)}
              onMouseEnter={() => setSelectedNodeId(node.id)}
              role="button"
              tabIndex={0}
              aria-label={`${node.title}, ${node.sha}`}
            >
              <circle r="8" />
              <text y="-13">{shortGraphLabel(node.title, 20)}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="semantic-graph-details">
        <div>
          <span className="signal-label">Selected commit</span>
          <strong>{selectedNode?.title ?? "None"}</strong>
          <span className="muted">
            {selectedNode
              ? `${selectedNode.sha} · ${selectedNode.author}${selectedNode.timestamp ? ` · ${new Date(selectedNode.timestamp).toLocaleDateString()}` : ""}`
              : "Select a point"}
          </span>
        </div>
        <div>
          <span className="signal-label">Commit metadata</span>
          <strong>{selectedNode?.topic ?? "—"}</strong>
          <span className="muted">{selectedNode?.message ?? "Hover or select a point"}</span>
        </div>
        <div>
          <span className="signal-label">Local neighborhood</span>
          <strong>{relatedEdges.length} links</strong>
          <span className="muted">{topics.join(", ")}</span>
        </div>
      </div>

      {visibleEdges.length > 0 ? (
        <ol className="semantic-edge-list">
          {visibleEdges.slice(0, 8).map((edge) => {
            const from = nodePositions.get(edge.from);
            const to = nodePositions.get(edge.to);
            return (
              <li key={`${edge.from}-${edge.to}`}>
                <span>{from?.title ?? edge.from}</span>
                <strong>{edge.weight.toFixed(3)}</strong>
                <span>{to?.title ?? edge.to}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="empty-state muted">No semantic edges meet the selected threshold.</p>
      )}
    </div>
  );
}

export function RepoView({ orgSlug, repoName }: { orgSlug: string; repoName: string }) {
  const router = useRouter();
  const { repos, ready, removeRepository } = useWorkspace();
  const { loading, error, summary, commits, graph } = useRepositoryData(orgSlug, repoName);
  const [query, setQuery] = useState("");
  const [memoryFilter, setMemoryFilter] = useState<"all" | "with-memory" | "without-memory">("all");
  const [authorFilter, setAuthorFilter] = useState("all");

  const authors = useMemo(
    () => Array.from(new Set(commits.map((commit) => commit.author))).sort(),
    [commits]
  );

  const filteredCommits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return commits.filter((commit) => {
      const hasMemory = Boolean(commit.memory);
      if (memoryFilter === "with-memory" && !hasMemory) return false;
      if (memoryFilter === "without-memory" && hasMemory) return false;
      if (authorFilter !== "all" && commit.author !== authorFilter) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        commit.sha,
        commit.message,
        commit.author,
        commit.memory?.title,
        commit.memory?.intent,
        commit.memory?.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [authorFilter, commits, memoryFilter, query]);

  const memoryCoverage = summary?.commitCount
    ? Math.round((summary.memoryCount / summary.commitCount) * 100)
    : 0;
  const topAuthor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const commit of commits) {
      counts.set(commit.author, (counts.get(commit.author) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [commits]);
  const latestMemory = commits.find((commit) => commit.memory)?.memory;

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
          <MemoryGraphPanel org={orgSlug} name={repoName} />

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

          <section className="panel repo-description-panel">
            <div className="panel-header">
              <h2>Semantic graph description</h2>
              <span className="muted">AgentGit vs GrepGit</span>
            </div>
            <p>{loading ? "Loading semantic graph context..." : (summary?.description ?? workspaceRepo.url)}</p>
          </section>

          <section className="panel workspace-intelligence">
            <div className="panel-header">
              <h2>Workspace signals</h2>
              <span className="muted">Derived from queried commits</span>
            </div>
            <div className="signal-grid">
              <div>
                <span className="signal-label">Memory coverage</span>
                <strong>{loading ? "..." : `${memoryCoverage}%`}</strong>
                <span className="signal-bar" aria-hidden="true">
                  <span style={{ width: `${memoryCoverage}%` }} />
                </span>
              </div>
              <div>
                <span className="signal-label">Most active author</span>
                <strong>{loading ? "..." : (topAuthor ? topAuthor[0] : "—")}</strong>
                <span className="muted">{topAuthor ? `${topAuthor[1]} commits` : "No commits"}</span>
              </div>
              <div>
                <span className="signal-label">Latest agent insight</span>
                <strong>{loading ? "..." : (latestMemory?.title ?? "No memory yet")}</strong>
                <span className="muted">{latestMemory?.intent ?? "Backfill memory to unlock insights."}</span>
              </div>
              <div>
                <span className="signal-label">Embedding graph</span>
                <strong>
                  {loading ? "..." : `${summary?.embeddingCount ?? 0} vectors`}
                </strong>
                <span className="muted">{summary?.semanticEdgeCount ?? 0} semantic links</span>
              </div>
            </div>
          </section>

          <section className="panel semantic-graph-panel">
            <div className="panel-header">
              <h2>Semantic Embedding Commit Graph</h2>
              <span className="muted">
                {loading
                  ? "Loading graph..."
                  : `${graph?.nodes.length ?? 0} nodes · ${graph?.edges.length ?? 0} edges`}
              </span>
            </div>
            {loading ? <p className="empty-state muted">Building semantic graph…</p> : <SemanticGraphView graph={graph} />}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Commits</h2>
              <span className="muted">
                {loading
                  ? "Loading…"
                  : `Showing ${filteredCommits.length} of ${commits.length}${summary ? ` · ${summary.memoryCount} with memory` : ""}`}
              </span>
            </div>
            <div className="commit-filters" aria-label="Commit filters">
              <label>
                <span className="sr-only">Search commits</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search commits, authors, or memory"
                />
              </label>
              <label>
                <span className="sr-only">Memory status</span>
                <select
                  value={memoryFilter}
                  onChange={(event) =>
                    setMemoryFilter(event.target.value as "all" | "with-memory" | "without-memory")
                  }
                >
                  <option value="all">All memory states</option>
                  <option value="with-memory">With memory</option>
                  <option value="without-memory">Without memory</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Author</span>
                <select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
                  <option value="all">All authors</option>
                  {authors.map((author) => (
                    <option value={author} key={author}>
                      {author}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {loading ? (
              <p className="empty-state muted">Fetching commit history…</p>
            ) : (
              <CommitMemoryList commits={filteredCommits} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

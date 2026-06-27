"use client";

import { useState } from "react";
import { CommitChangeSummary } from "@/components/CommitChangeSummary";
import type { Commit } from "@/lib/types";
import { summarizeChangeScope } from "@/lib/commitChangeSummary";

export function CommitMemoryList({
  commits,
  org,
  repo,
}: {
  commits: Commit[];
  org: string;
  repo: string;
}) {
  const [expandedSha, setExpandedSha] = useState<string | null>(null);

  if (commits.length === 0) {
    return (
      <div className="empty-state">
        <p className="muted">No commits yet.</p>
      </div>
    );
  }

  return (
    <ul className="commit-memory-list">
      {commits.map((commit) => {
        const expanded = expandedSha === commit.sha;
        const scope = summarizeChangeScope(commit);
        const hasMemory = Boolean(commit.memory);

        return (
          <li className={`commit-memory-item${expanded ? " is-expanded" : ""}`} key={commit.sha}>
            <button
              type="button"
              className="commit-memory-toggle"
              aria-expanded={expanded}
              onClick={() => setExpandedSha(expanded ? null : commit.sha)}
            >
              <div className="commit-memory-git">
                <div className="commit-memory-head">
                  <code>{commit.sha}</code>
                  <span className="commit-message">{commit.message}</span>
                </div>
                <p className="muted">
                  {commit.author} · {commit.relativeTime}
                  {hasMemory ? " · agent memory" : " · no memory"}
                </p>
                {scope && !expanded ? (
                  <p className="commit-change-preview muted">
                    {scope.fileCount > 0
                      ? `${scope.fileCount} ${scope.fileCount === 1 ? "file" : "files"}`
                      : scope.modules.length > 0
                        ? scope.modules.slice(0, 3).join(", ")
                        : null}
                    {commit.memory?.title ? ` · ${commit.memory.title}` : null}
                  </p>
                ) : null}
              </div>
              <span className="commit-memory-chevron" aria-hidden="true">
                {expanded ? "−" : "+"}
              </span>
            </button>

            {expanded ? <CommitChangeSummary commit={commit} org={org} repo={repo} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

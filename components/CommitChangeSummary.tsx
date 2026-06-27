"use client";

import { useEffect, useState } from "react";
import type { Commit } from "@/lib/types";
import {
  changeTypeLabel,
  commitHeadline,
  summarizeChangeScope,
} from "@/lib/commitChangeSummary";

type CommitChangeSummaryProps = {
  commit: Commit;
  org: string;
  repo: string;
};

export function CommitChangeSummary({ commit, org, repo }: CommitChangeSummaryProps) {
  const [files, setFiles] = useState(commit.affectedFiles);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  useEffect(() => {
    setFiles(commit.affectedFiles);
    setFilesError(null);
  }, [commit.sha, commit.affectedFiles]);

  useEffect(() => {
    if (commit.affectedFiles?.length) return;

    let cancelled = false;
    setLoadingFiles(true);
    setFilesError(null);

    fetch(`/api/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(commit.sha)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not load file summary.");
        }
        return res.json() as Promise<{ affectedFiles: Commit["affectedFiles"] }>;
      })
      .then((data) => {
        if (!cancelled) setFiles(data.affectedFiles);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFiles(undefined);
          setFilesError(err instanceof Error ? err.message : "Could not load file summary.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [commit.affectedFiles, commit.sha, org, repo]);

  const scope = summarizeChangeScope({ ...commit, affectedFiles: files });
  const headline = commitHeadline(commit);

  return (
    <div className="commit-change-summary">
      <div className="commit-change-head">
        <p className="memory-label">Summary</p>
        <h3>{headline}</h3>
        {commit.memory?.intent && commit.memory.intent !== headline ? (
          <p>{commit.memory.intent}</p>
        ) : null}
        {!commit.memory ? (
          <p className="muted">No agent memory yet — showing git metadata and file scope only.</p>
        ) : null}
      </div>

      {scope ? (
        <div className="commit-change-scope">
          {scope.modules.length > 0 ? (
            <div className="commit-intel-row" aria-label="Modules touched">
              {scope.modules.map((module) => (
                <span key={module}>{module}</span>
              ))}
            </div>
          ) : null}
          <p className="commit-change-meta muted">
            {scope.fileCount > 0 ? (
              <>
                {scope.fileCount} {scope.fileCount === 1 ? "file" : "files"} · +{scope.additions} −
                {scope.deletions}
              </>
            ) : (
              <>Scope inferred from agent memory</>
            )}
            {scope.changeTypes.length > 0
              ? ` · ${scope.changeTypes.map(({ type, count }) => `${count} ${changeTypeLabel(type).toLowerCase()}`).join(", ")}`
              : null}
            {commit.memory?.impact ? ` · ${commit.memory.impact} impact` : null}
          </p>
        </div>
      ) : null}

      {loadingFiles ? <p className="commit-change-meta muted">Loading file scope…</p> : null}
      {filesError ? <p className="commit-change-meta muted">{filesError}</p> : null}

      {files && files.length > 0 ? (
        <div className="commit-change-files">
          <p className="memory-label">Files touched</p>
          <ul>
            {files.map((file) => (
              <li key={file.path}>
                <span className={`change-badge change-${file.changeType}`}>
                  {changeTypeLabel(file.changeType)}
                </span>
                <span className="commit-file-path">{file.path}</span>
                <span className="commit-file-stats">
                  +{file.additions} −{file.deletions}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {commit.memory?.notes ? (
        <blockquote className="commit-change-notes">
          <p className="memory-label">Notes for future agents</p>
          {commit.memory.notes}
        </blockquote>
      ) : null}

      {commit.memory?.related && commit.memory.related.length > 0 ? (
        <div className="commit-related-graph">
          <span>Related changes</span>
          <ul>
            {commit.memory.related.map((related) => (
              <li key={related.sha}>
                <code>{related.sha}</code>
                <strong>{related.title}</strong>
                <span>{Math.round(related.similarity * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

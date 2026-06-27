"use client";

import { useCallback, useEffect, useState } from "react";
import { UI_GRAPH_THRESHOLD } from "@/lib/graphConfig";

type MemoryGraphPanelProps = {
  org: string;
  name: string;
};

export function MemoryGraphPanel({ org, name }: MemoryGraphPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMeta(null);

    try {
      const res = await fetch(
        `/api/repos/${encodeURIComponent(org)}/${encodeURIComponent(name)}/graph?threshold=${UI_GRAPH_THRESHOLD}&v=${Date.now()}`
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to generate graph");
      }

      const html = await res.text();
      const nodes = res.headers.get("X-Graph-Nodes");
      const edges = res.headers.get("X-Graph-Edges");
      if (nodes && edges) {
        setMeta(`${nodes} · ${edges} links`);
      }

      setIframeSrc((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(new Blob([html], { type: "text/html" }));
      });
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate graph");
    } finally {
      setLoading(false);
    }
  }, [org, name]);

  useEffect(() => {
    return () => {
      if (iframeSrc) URL.revokeObjectURL(iframeSrc);
    };
  }, [iframeSrc]);

  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <div>
          <h2>Memory graph</h2>
          {meta ? <span className="muted">{meta}</span> : null}
        </div>
        <div className="page-actions-group">
          <button
            type="button"
            className="button-secondary"
            disabled={loading}
            onClick={() => {
              if (open) setOpen(false);
              else void loadGraph();
            }}
          >
            {loading ? "…" : open ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={loading}
            onClick={() => void loadGraph()}
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="empty-panel">
          <p className="form-error">{error}</p>
        </div>
      ) : null}

      {open && iframeSrc && !error ? (
        <iframe title={`Memory graph for ${org}/${name}`} src={iframeSrc} className="graph-frame" />
      ) : null}
    </section>
  );
}

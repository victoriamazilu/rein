"use client";

import { useEffect, useState } from "react";
import type { Commit, RepositorySummary } from "@/lib/types";

type RepoDataState = {
  loading: boolean;
  error: string | null;
  summary: RepositorySummary | null;
  commits: Commit[];
};

export function useRepositoryData(org: string, name: string): RepoDataState {
  const [state, setState] = useState<RepoDataState>({
    loading: true,
    error: null,
    summary: null,
    commits: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const res = await fetch(`/api/repos/${encodeURIComponent(org)}/${encodeURIComponent(name)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load repository");
        }

        if (!cancelled) {
          const { commits, ...summary } = data as RepositorySummary & { commits: Commit[] };
          setState({
            loading: false,
            error: null,
            summary: summary as RepositorySummary,
            commits: commits ?? [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load repository",
            summary: null,
            commits: [],
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [org, name]);

  return state;
}

export function useRepositorySummary(org: string, name: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RepositorySummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/repos/${encodeURIComponent(org)}/${encodeURIComponent(name)}?summary=1`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load repository");
        }

        if (!cancelled) {
          setSummary(data as RepositorySummary);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load repository");
          setSummary(null);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [org, name]);

  return { loading, error, summary };
}

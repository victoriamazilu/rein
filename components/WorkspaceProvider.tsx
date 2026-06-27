"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addRepository as addRepositoryToStorage,
  loadWorkspace,
  removeRepository as removeRepositoryFromStorage,
} from "@/lib/workspace";
import type { WorkspaceRepo } from "@/lib/types";

type WorkspaceContextValue = {
  repos: WorkspaceRepo[];
  ready: boolean;
  addRepository: (url: string) => WorkspaceRepo;
  removeRepository: (org: string, name: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [repos, setRepos] = useState<WorkspaceRepo[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRepos(loadWorkspace());
    setReady(true);
  }, []);

  const addRepository = useCallback((url: string) => {
    const repo = addRepositoryToStorage(url);
    setRepos(loadWorkspace());
    return repo;
  }, []);

  const removeRepository = useCallback((org: string, name: string) => {
    removeRepositoryFromStorage(org, name);
    setRepos(loadWorkspace());
  }, []);

  const value = useMemo(
    () => ({ repos, ready, addRepository, removeRepository }),
    [repos, ready, addRepository, removeRepository]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

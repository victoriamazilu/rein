import type { Commit } from "./types";

export type ChangeScope = {
  fileCount: number;
  additions: number;
  deletions: number;
  modules: string[];
  changeTypes: Array<{ type: string; count: number }>;
};

const CHANGE_LABELS: Record<string, string> = {
  added: "New",
  modified: "Updated",
  deleted: "Removed",
  renamed: "Moved",
  removed: "Removed",
  copied: "Copied",
  changed: "Changed",
};

export function changeTypeLabel(changeType: string): string {
  return CHANGE_LABELS[changeType] ?? changeType;
}

export function inferModuleFromPath(path: string): string {
  const segment = path.split("/").find(Boolean);
  return segment ?? "root";
}

export function summarizeChangeScope(commit: Commit): ChangeScope | null {
  const files = commit.affectedFiles ?? [];
  if (files.length === 0 && !commit.modules?.length && !commit.memory?.modules?.length) {
    return null;
  }

  const modules = Array.from(
    new Set([...(commit.modules ?? []), ...(commit.memory?.modules ?? []), ...files.map((f) => f.module)])
  ).filter(Boolean);

  const typeCounts = new Map<string, number>();
  for (const file of files) {
    typeCounts.set(file.changeType, (typeCounts.get(file.changeType) ?? 0) + 1);
  }

  return {
    fileCount: files.length,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    modules,
    changeTypes: Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count })),
  };
}

export function commitHeadline(commit: Commit): string {
  return commit.memory?.title ?? commit.message;
}

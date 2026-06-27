import { repoKey } from "./types";

/** Demo repositories backed by data/local-repository-db.json */
export const LOCAL_SEED_REPOS = [
  { org: "acme-ai", name: "insight-studio" },
  { org: "acme-ai", name: "eval-runner" },
  { org: "northstar-labs", name: "backboard" },
  { org: "northstar-labs", name: "release-gate" },
] as const;

const LOCAL_SEED_REPO_KEYS = new Set(
  LOCAL_SEED_REPOS.map((repo) => repoKey(repo.org, repo.name))
);

export function isLocalSeedRepo(org: string, name: string): boolean {
  return LOCAL_SEED_REPO_KEYS.has(repoKey(org, name));
}

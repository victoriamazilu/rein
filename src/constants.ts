export const DEFAULT_SEARCH_COUNT = 10;
export const MAX_SEARCH_COUNT = 50;
export const EMBEDDING_DIMENSIONS = 1536;

/** Hybrid search weights — keep in sync with match_agent_commits RPC. */
export const VECTOR_SEARCH_WEIGHT = 0.65;
export const KEYWORD_SEARCH_WEIGHT = 0.35;

export function clampSearchCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("--count must be a positive number");
  }
  return Math.min(Math.floor(count), MAX_SEARCH_COUNT);
}

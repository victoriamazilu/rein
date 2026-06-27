import { AgentCommitStore, createSupabase } from "./db.js";
import {
  getCommitDiff,
  getCommitSubject,
  getRecentCommitsBefore,
  listCommitShas,
} from "./git.js";
import { distillAgentCommit, embedText } from "./llm.js";

export interface BackfillOptions {
  from?: string;
  to?: string;
  max?: number;
  dryRun?: boolean;
  skipExisting?: boolean;
  force?: boolean;
  delayMs?: number;
  cwd?: string;
  store?: AgentCommitStore;
}

export interface BackfillResult {
  total: number;
  stored: number;
  skipped: number;
  failed: { sha: string; error: string }[];
}

export async function backfillAgentCommits(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const cwd = options.cwd ?? process.cwd();
  const store = options.store ?? new AgentCommitStore(createSupabase());
  const skipExisting = options.skipExisting ?? !options.force;
  const shas = listCommitShas(
    { from: options.from, to: options.to, max: options.max },
    cwd
  );

  const result: BackfillResult = {
    total: shas.length,
    stored: 0,
    skipped: 0,
    failed: [],
  };

  for (let index = 0; index < shas.length; index++) {
    const sha = shas[index];
    const short = sha.slice(0, 7);
    const label = `[${index + 1}/${shas.length}] ${short}`;

    try {
      if (skipExisting) {
        const existing = await store.getBySha(sha);
        if (existing) {
          console.log(`${label} skip (already stored)`);
          result.skipped++;
          continue;
        }
      }

      const subject = getCommitSubject(sha, cwd);
      const diff = getCommitDiff(sha, cwd);
      if (!diff) {
        console.log(`${label} skip (empty diff)`);
        result.skipped++;
        continue;
      }

      console.log(`${label} distilling: ${subject}`);
      const recentCommits = getRecentCommitsBefore(sha, 5, cwd);
      const distilled = await distillAgentCommit({
        status: `Backfill commit: ${subject}`,
        recentCommits,
        stagedDiff: diff,
      });

      if (options.dryRun) {
        console.log(JSON.stringify({ sha, ...distilled }, null, 2));
        result.stored++;
        continue;
      }

      console.log(`${label} embedding...`);
      const embedding = await embedText(distilled.embedding_text);

      console.log(`${label} storing...`);
      if (options.force) {
        await store.upsert({
          sha,
          title: distilled.title,
          intent: distilled.intent,
          reasoning_trace: distilled.reasoning_trace,
          notes_for_future_agents: distilled.notes_for_future_agents,
          embedding_text: distilled.embedding_text,
          embedding,
        });
      } else {
        await store.create({
          sha,
          title: distilled.title,
          intent: distilled.intent,
          reasoning_trace: distilled.reasoning_trace,
          notes_for_future_agents: distilled.notes_for_future_agents,
          embedding_text: distilled.embedding_text,
          embedding,
        });
      }

      result.stored++;
      console.log(`${label} done — ${distilled.title}`);

      if (options.delayMs && index < shas.length - 1) {
        await sleep(options.delayMs);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${label} failed: ${message}`);
      result.failed.push({ sha, error: message });
    }
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

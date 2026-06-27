import OpenAI from "openai";
import type { DistilledAgentCommit } from "./types.js";

const DEFAULT_MODEL = process.env.AGENTGIT_MODEL ?? "gpt-4o-mini";
const DEFAULT_EMBEDDING_MODEL =
  process.env.AGENTGIT_EMBEDDING_MODEL ?? "text-embedding-3-small";

function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function embedText(text: string): Promise<number[]> {
  const client = openai();
  const res = await client.embeddings.create({
    model: DEFAULT_EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

export async function distillAgentCommit(input: {
  status: string;
  recentCommits: string;
  stagedDiff: string;
}): Promise<DistilledAgentCommit> {
  const client = openai();
  const truncatedDiff = truncate(input.stagedDiff, 120_000);

  const prompt = `You just completed a coding task.

Given the staged git diff, produce durable project memory for future coding agents.

Return strict JSON with this exact shape:
{
  "title": string,
  "commit_message": string,
  "intent": string,
  "reasoning_trace": string,
  "notes_for_future_agents": string,
  "embedding_text": string
}

Guidelines:
- Be concise but useful.
- title: short memory note name for graph UI — 2-5 words, Title Case, no trailing period (e.g. "Search Tips Doc", "Memory Graph View", "DB Setup Fix").
- Focus on decisions, intent, and future implications.
- Do not describe obvious line-by-line changes.
- Do not include generic advice.
- embedding_text should combine semantic information future agents might search for; include the title concept.
- commit_message should be a normal concise git commit message.

Git status:
${input.status || "(empty)"}

Recent commits:
${input.recentCommits || "(none)"}

Staged diff:
${truncatedDiff}`;

  const content = await completeJson(client, prompt);

  try {
    return parseAndValidateDistillation(content);
  } catch (err) {
    const repaired = await completeJson(
      client,
      `Repair this invalid AgentCommit distillation output.\n\nError: ${
        err instanceof Error ? err.message : String(err)
      }\n\nReturn only strict JSON with this exact shape:\n{\n  "commit_message": string,\n  "intent": string,\n  "reasoning_trace": string,\n  "notes_for_future_agents": string,\n  "embedding_text": string\n}\n\nInvalid output:\n${content}`
    );
    return parseAndValidateDistillation(repaired);
  }
}

async function completeJson(client: OpenAI, prompt: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned no content");
  return content;
}

function parseAndValidateDistillation(content: string): DistilledAgentCommit {
  try {
    return validateDistillation(JSON.parse(content));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid AgentCommit distillation JSON: ${message}`);
  }
}

function validateDistillation(value: unknown): DistilledAgentCommit {
  if (!value || typeof value !== "object") {
    throw new Error("Distillation result was not an object");
  }

  const obj = value as Record<string, unknown>;
  const result: DistilledAgentCommit = {
    title: validateTitle(requiredString(obj, "title")),
    commit_message: requiredString(obj, "commit_message"),
    intent: requiredString(obj, "intent"),
    reasoning_trace: requiredString(obj, "reasoning_trace"),
    notes_for_future_agents: requiredString(obj, "notes_for_future_agents"),
    embedding_text: requiredString(obj, "embedding_text"),
  };

  return result;
}

const MAX_TITLE_LENGTH = 40;

function validateTitle(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1)}…`;
  }
  return trimmed;
}

function requiredString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Distillation result missing ${key}`);
  }
  return value.trim();
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[diff truncated to ${maxChars} characters]`;
}

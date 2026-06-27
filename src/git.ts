import { execFileSync, execSync } from "node:child_process";

export function git(args: string[], cwd = process.cwd()): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

export function isInsideGitRepo(cwd = process.cwd()): boolean {
  try {
    return git(["rev-parse", "--is-inside-work-tree"], cwd) === "true";
  } catch {
    return false;
  }
}

export function getHeadSha(cwd = process.cwd()): string {
  return git(["rev-parse", "HEAD"], cwd);
}

export function resolveCommitSha(ref: string, cwd = process.cwd()): string {
  return git(["rev-parse", "--verify", `${ref}^{commit}`], cwd);
}

export function getStagedDiff(cwd = process.cwd()): string {
  return execSync("git diff --cached", { cwd, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }).trim();
}

export function hasStagedChanges(cwd = process.cwd()): boolean {
  try {
    execFileSync("git", ["diff", "--cached", "--quiet"], { cwd });
    return false;
  } catch {
    return true;
  }
}

export function getStatusShort(cwd = process.cwd()): string {
  return execSync("git status --short", { cwd, encoding: "utf-8" }).trim();
}

export function hasUnstagedChanges(cwd = process.cwd()): boolean {
  const status = getStatusShort(cwd);
  if (!status) return false;

  return status.split("\n").some((line) => {
    if (line.startsWith("??")) return true;
    return line.length >= 2 && line[1] !== " ";
  });
}

export function getRecentCommits(cwd = process.cwd()): string {
  try {
    return execSync("git log -5 --oneline", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export function listCommitShas(
  options: { from?: string; to?: string; max?: number } = {},
  cwd = process.cwd()
): string[] {
  const args = ["log", "--reverse", "--format=%H"];

  if (options.max !== undefined) {
    args.push("-n", String(options.max));
  }

  if (options.from && options.to) {
    args.push(`${options.from}^..${options.to}`);
  } else if (options.from) {
    args.push(`${options.from}^..HEAD`);
  } else if (options.to) {
    args.push(options.to);
  } else {
    args.push("HEAD");
  }

  const output = git(args, cwd);
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

export function getCommitSubject(sha: string, cwd = process.cwd()): string {
  return git(["log", "-1", "--format=%s", sha], cwd);
}

function getCommitParent(sha: string, cwd = process.cwd()): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--verify", `${sha}^`], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function getCommitDiff(sha: string, cwd = process.cwd()): string {
  const parent = getCommitParent(sha, cwd);
  const args = parent
    ? ["diff", `${parent}..${sha}`]
    : ["show", sha, "--format=", "--patch"];

  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function getRecentCommitsBefore(
  sha: string,
  count = 5,
  cwd = process.cwd()
): string {
  const parent = getCommitParent(sha, cwd);
  if (!parent) return "";

  return execFileSync("git", ["log", `-${count}`, "--oneline", parent], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function createGitCommit(message: string, cwd = process.cwd()): void {
  execFileSync("git", ["commit", "-m", message], { cwd, stdio: "inherit" });
}

export function getRemoteRepo(cwd = process.cwd()): string {
  const url = git(["remote", "get-url", "origin"], cwd);

  const sshMatch = url.match(/git@github\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  const httpsMatch = url.match(/github\.com\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  return url;
}

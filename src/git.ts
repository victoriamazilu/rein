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

export function getRecentCommits(cwd = process.cwd()): string {
  try {
    return execSync("git log -5 --oneline", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
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

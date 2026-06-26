import { execSync } from "node:child_process";

export function getHeadSha(cwd = process.cwd()): string {
  return execSync("git rev-parse HEAD", { cwd, encoding: "utf-8" }).trim();
}

export function getRemoteRepo(cwd = process.cwd()): string {
  const url = execSync("git remote get-url origin", {
    cwd,
    encoding: "utf-8",
  }).trim();

  // Normalize github.com URLs to owner/repo form
  const sshMatch = url.match(/git@github\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  const httpsMatch = url.match(/github\.com\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  return url;
}

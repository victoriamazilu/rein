const GITHUB_API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

type GitHubRepo = {
  default_branch: string;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
  private: boolean;
};

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string } | null;
};

function headers(): HeadersInit {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

async function githubFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: headers(),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404) {
      throw new GitHubError("Repository not found on GitHub.", 404);
    }
    if (res.status === 403) {
      throw new GitHubError(
        "GitHub rate limit or private repo — add GITHUB_TOKEN to .env.",
        403
      );
    }
    throw new GitHubError(body || `GitHub API error (${res.status})`, res.status);
  }

  return res.json() as Promise<T>;
}

export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return githubFetch<GitHubRepo>(`/repos/${owner}/${repo}`);
}

export async function fetchGitHubCommitsPage(
  owner: string,
  repo: string,
  branch: string,
  page: number,
  perPage = 100
): Promise<GitHubCommit[]> {
  const params = new URLSearchParams({
    sha: branch,
    per_page: String(perPage),
    page: String(page),
  });
  return githubFetch<GitHubCommit[]>(`/repos/${owner}/${repo}/commits?${params}`);
}

export async function countGitHubCommits(
  owner: string,
  repo: string,
  branch: string
): Promise<number> {
  let total = 0;
  let page = 1;

  while (page <= 20) {
    const commits = await fetchGitHubCommitsPage(owner, repo, branch, page, 100);
    total += commits.length;
    if (commits.length < 100) break;
    page++;
  }

  return total;
}

export async function fetchRecentGitHubCommits(
  owner: string,
  repo: string,
  branch: string,
  limit = 30
): Promise<GitHubCommit[]> {
  const commits = await fetchGitHubCommitsPage(owner, repo, branch, 1, Math.min(limit, 100));
  return commits.slice(0, limit);
}

export type { GitHubCommit, GitHubRepo };

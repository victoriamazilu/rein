export type ParsedRepoUrl = {
  org: string;
  name: string;
  url: string;
};

export function parseRepoUrl(raw: string): ParsedRepoUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a repository URL.");
  }

  const withoutGit = trimmed.replace(/\.git$/i, "");

  const shorthand = withoutGit.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthand && !withoutGit.includes("://") && !withoutGit.includes("@")) {
    const org = shorthand[1];
    const name = shorthand[2];
    return {
      org,
      name,
      url: `https://github.com/${org}/${name}.git`,
    };
  }

  const ssh = withoutGit.match(/^git@[^:]+:([^/]+)\/([^/]+)$/);
  if (ssh) {
    return {
      org: ssh[1],
      name: ssh[2],
      url: trimmed.endsWith(".git") ? trimmed : `${withoutGit}.git`,
    };
  }

  const https = withoutGit.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)$/);
  if (https) {
    return {
      org: https[1],
      name: https[2],
      url: `https://github.com/${https[1]}/${https[2]}.git`,
    };
  }

  throw new Error("Use a git clone URL or owner/repo (e.g. https://github.com/you/project.git).");
}

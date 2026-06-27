import { NextResponse } from "next/server";
import { fetchGitHubCommitDetail, GitHubError } from "@/lib/github";
import { loadLocalRepositoryData } from "@/lib/localRepositoryDb";
import { isLocalSeedRepo } from "@/lib/localSeedRepos";

type RouteParams = {
  params: Promise<{ org: string; repo: string; sha: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { org, repo, sha } = await params;
  const source = process.env.REIN_REPOSITORY_DATA_SOURCE ?? "auto";

  if (source === "local" || (source === "auto" && isLocalSeedRepo(org, repo))) {
    const local = await loadLocalRepositoryData(org, repo);
    const commit = local?.commits.find(
      (item) => item.sha === sha || item.sha.startsWith(sha) || sha.startsWith(item.sha)
    );
    if (!commit?.affectedFiles?.length) {
      return NextResponse.json({ error: "Commit file summary not found." }, { status: 404 });
    }
    return NextResponse.json({ affectedFiles: commit.affectedFiles });
  }

  try {
    const detail = await fetchGitHubCommitDetail(org, repo, sha);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not load commit summary." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

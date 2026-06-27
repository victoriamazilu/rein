import { NextResponse } from "next/server";
import { GitHubError, loadRepositoryData } from "@/lib/repoData";

type RouteParams = { params: Promise<{ org: string; repo: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { org, repo } = await params;
  const owner = decodeURIComponent(org);
  const name = decodeURIComponent(repo);
  const summaryOnly = new URL(request.url).searchParams.get("summary") === "1";

  try {
    const data = await loadRepositoryData(owner, name);

    if (summaryOnly) {
      return NextResponse.json(data.summary);
    }

    return NextResponse.json({
      ...data.summary,
      commits: data.commits,
    });
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    const message = err instanceof Error ? err.message : "Failed to load repository";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

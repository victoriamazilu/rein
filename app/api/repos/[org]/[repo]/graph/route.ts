import { NextResponse } from "next/server";
import { generateRepositoryGraphHtml, UI_GRAPH_THRESHOLD } from "@/lib/agentGraph";

type RouteParams = { params: Promise<{ org: string; repo: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { org, repo } = await params;
  const owner = decodeURIComponent(org);
  const name = decodeURIComponent(repo);
  const url = new URL(request.url);

  const thresholdParam = url.searchParams.get("threshold");
  const threshold = thresholdParam
    ? Number.parseFloat(thresholdParam)
    : UI_GRAPH_THRESHOLD;

  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    return NextResponse.json({ error: "threshold must be between 0 and 1" }, { status: 400 });
  }

  try {
    const result = await generateRepositoryGraphHtml(owner, name, threshold);

    return new NextResponse(result.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Graph-Nodes": String(result.nodeCount),
        "X-Graph-Edges": String(result.edgeCount),
        "X-Graph-Threshold": String(result.threshold),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate graph";
    const status = message.includes("No agent_commits") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

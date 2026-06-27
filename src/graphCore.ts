import type { AgentCommit } from "./types.js";

export interface GraphNode {
  id: string;
  sha: string;
  shortSha: string;
  title: string;
  label: string;
  intent: string;
  notes: string;
  createdAt: string;
  embedding: number[] | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: "semantic" | "temporal" | "search";
  weight: number;
  label?: string;
}

/** Default minimum similarity to draw a semantic link between commits. */
export const DEFAULT_SEMANTIC_THRESHOLD = 0.5;

export interface MemoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  semanticThreshold: number;
}

export function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "number") ? (value as number[]) : null;
  }
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "number")
      ? (parsed as number[])
      : null;
  } catch {
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

const GENERIC_GRAPH_TOKENS = new Set([
  "add",
  "adds",
  "added",
  "adding",
  "change",
  "changes",
  "component",
  "components",
  "experience",
  "feature",
  "fix",
  "improve",
  "improves",
  "improved",
  "project",
  "projects",
  "refactor",
  "section",
  "sections",
  "setup",
  "update",
  "updates",
  "updated",
  "user",
  "users",
]);

function graphText(node: GraphNode): string {
  return `${node.title} ${node.intent} ${node.notes}`.toLowerCase();
}

function graphTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !GENERIC_GRAPH_TOKENS.has(token))
  );
}

function lexicalGraphSimilarity(a: GraphNode, b: GraphNode): number {
  const aTokens = graphTokens(graphText(a));
  const bTokens = graphTokens(graphText(b));

  let sharedTokenCount = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) sharedTokenCount++;
  }

  if (sharedTokenCount === 0) return 0;

  const smallerSetCoverage = sharedTokenCount / Math.min(aTokens.size, bTokens.size);
  const diceCoefficient = (2 * sharedTokenCount) / (aTokens.size + bTokens.size);

  return Math.max(smallerSetCoverage, diceCoefficient);
}

function graphSimilarity(a: GraphNode, b: GraphNode): number {
  const embeddingSimilarity =
    a.embedding && b.embedding ? cosineSimilarity(a.embedding, b.embedding) : 0;
  return Math.max(embeddingSimilarity, lexicalGraphSimilarity(a, b));
}

export function shortenGraphLabel(text: string, maxLength = 26): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function intentToTitle(intent: string, maxLength = 52): string {
  let text = intent.trim();
  if (/^to\s+/i.test(text)) text = text.replace(/^to\s+/i, "");
  const firstSentence = text.match(/^[^.!?]+/)?.[0]?.trim() ?? text;
  text = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function nodeTitle(commit: AgentCommit): string {
  if (commit.title?.trim()) return commit.title.trim();
  return intentToTitle(commit.intent, 40);
}

function nodeLabel(commit: AgentCommit, title: string): string {
  if (commit.title?.trim()) return commit.title.trim();
  return shortenGraphLabel(title, 22);
}

export function buildMemoryGraph(
  commits: AgentCommit[],
  opts?: { similarityThreshold?: number; maxSemanticEdgesPerNode?: number }
): MemoryGraph {
  const threshold = opts?.similarityThreshold ?? DEFAULT_SEMANTIC_THRESHOLD;
  const maxPerNode = opts?.maxSemanticEdgesPerNode ?? 4;

  const nodes: GraphNode[] = commits
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((commit) => {
      const title = nodeTitle(commit);
      return {
        id: commit.id,
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        title,
        label: nodeLabel(commit, title),
        intent: commit.intent,
        notes: commit.notes_for_future_agents,
        createdAt: commit.created_at,
        embedding: parseEmbedding(commit.embedding),
      };
    });

  const edges: GraphEdge[] = [];
  const edgeKey = (from: string, to: string) => `${from}:${to}`;

  for (let i = 0; i < nodes.length; i++) {
    const source = nodes[i];

    const neighbors: GraphEdge[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const target = nodes[j];

      const similarity = graphSimilarity(source, target);
      if (similarity < threshold) continue;

      neighbors.push({
        from: source.id,
        to: target.id,
        kind: "semantic",
        weight: similarity,
        label: similarity.toFixed(3),
      });
    }

    neighbors
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxPerNode)
      .forEach((edge) => {
        const key = edgeKey(edge.from, edge.to);
        const reverse = edgeKey(edge.to, edge.from);
        if (edges.some((e) => edgeKey(e.from, e.to) === key || edgeKey(e.from, e.to) === reverse)) {
          return;
        }
        edges.push(edge);
      });
  }

  return { nodes, edges, semanticThreshold: threshold };
}

export function addSearchEdges(
  graph: MemoryGraph,
  results: Array<{ id: string; combined_score: number }>,
  queryLabel?: string
): MemoryGraph {
  if (results.length === 0) return graph;

  const searchRootId = "__search__";
  const searchTitle = queryLabel?.trim()
    ? `Search: ${queryLabel.trim()}`
    : "Search query";
  const searchNode: GraphNode = {
    id: searchRootId,
    sha: "query",
    shortSha: "query",
    title: searchTitle,
    label: shortenGraphLabel(searchTitle, 22),
    intent: "Search query (simulated agent lookup)",
    notes: "Edges show what a rein search would surface.",
    createdAt: new Date().toISOString(),
    embedding: null,
  };

  const edges = results.map((result) => ({
    from: searchRootId,
    to: result.id,
    kind: "search" as const,
    weight: result.combined_score,
    label: result.combined_score.toFixed(3),
  }));

  return {
    ...graph,
    nodes: [searchNode, ...graph.nodes],
    edges: [...edges, ...graph.edges],
  };
}

export function renderGraphHtml(graph: MemoryGraph, title = "Rein Memory Graph"): string {
  const threshold = graph.semanticThreshold;
  const payload = JSON.stringify(graph);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; overflow: hidden; }
    body {
      font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #f6f8fa;
      color: #1f2328;
    }
    #canvas {
      position: fixed;
      inset: 0;
      cursor: grab;
    }
    #canvas:active { cursor: grabbing; }
    .link { fill: none; stroke-linecap: round; }
    .link.temporal { stroke-dasharray: 3 5; }
    .node circle { stroke-width: 1.5px; transition: r 0.15s ease; }
    .node-title {
      font-size: 12px;
      font-weight: 500;
      fill: rgba(31, 35, 40, 0.62);
    }
    .node-sub {
      font-size: 9px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      fill: rgba(101, 109, 118, 0.75);
    }
    .node.active .node-title { fill: rgba(31, 35, 40, 0.96); }
    .node.active .node-sub { fill: rgba(9, 105, 218, 0.85); }
    .node.dim .node-title { fill: rgba(31, 35, 40, 0.12); }
    .node.dim .node-sub { fill: rgba(101, 109, 118, 0.1); }
    .hud {
      position: fixed;
      top: 14px;
      left: 14px;
      z-index: 2;
      pointer-events: none;
    }
    .hud h1 {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #1f2328;
    }
    .hud p {
      margin: 0;
      font-size: 11px;
      color: #656d76;
    }
    #detail {
      position: fixed;
      top: 14px;
      right: 14px;
      width: min(340px, calc(100vw - 28px));
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 14px 16px;
      display: none;
      max-height: calc(100vh - 28px);
      overflow: auto;
      backdrop-filter: blur(8px);
      box-shadow: 0 8px 32px rgb(26 26 26 / 0.06);
      z-index: 2;
    }
    #detail h2 {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
      color: #1f2328;
      line-height: 1.35;
    }
    #detail .sha {
      display: block;
      margin-bottom: 10px;
      font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #656d76;
    }
    #detail .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #656d76;
      margin: 10px 0 4px;
    }
    #detail p {
      margin: 0;
      color: #1f2328;
      white-space: pre-wrap;
    }
    #detail code {
      display: block;
      margin-top: 12px;
      font-size: 10px;
      color: #0969da;
      word-break: break-all;
    }
    .controls {
      position: fixed;
      bottom: 14px;
      left: 14px;
      display: flex;
      gap: 8px;
      z-index: 2;
    }
    .controls button {
      background: #ffffff;
      border: 1px solid #d0d7de;
      color: #1f2328;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 11px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgb(26 26 26 / 0.04);
    }
    .controls button:hover {
      color: #0550ae;
      border-color: #0969da;
      background: #f6f8fa;
    }
  </style>
</head>
<body>
  <div class="hud">
    <h1>${escapeHtml(title)}</h1>
    <p id="hud-stats">${graph.nodes.length} notes · semantic links ≥ ${threshold.toFixed(2)} · drag · scroll to zoom</p>
  </div>
  <svg id="canvas"></svg>
  <div id="detail"></div>
  <div class="controls">
    <button type="button" id="fit">Fit view</button>
    <button type="button" id="restart">Restart simulation</button>
  </div>
  <script>
    const raw = ${payload};
    const semanticThreshold = raw.semanticThreshold ?? ${threshold};
    const nodesById = Object.fromEntries(raw.nodes.map((n) => [n.id, n]));

    const nodes = raw.nodes.map((n) => ({
      ...n,
      isSearch: n.id === "__search__",
    }));

    const links = raw.edges.map((e) => ({
      source: e.from,
      target: e.to,
      kind: e.kind,
      weight: e.weight,
    }));

    function semanticStrokeWidth(weight, threshold) {
      if (weight < threshold) return 0;
      const span = Math.max(1 - threshold, 0.01);
      return 2 + ((weight - threshold) / span) * 2.5;
    }

    const visibleLinks = links.filter(
      (l) => l.kind !== "semantic" || l.weight >= semanticThreshold
    );
    const semanticCount = visibleLinks.filter((l) => l.kind === "semantic").length;
    const hudStats = document.getElementById("hud-stats");
    if (semanticCount === 0) {
      hudStats.textContent =
        raw.nodes.length + " notes · no semantic links at ≥ " + semanticThreshold.toFixed(2) +
        " · try --threshold 0.50";
    } else {
      hudStats.textContent =
        raw.nodes.length + " notes · " + semanticCount + " semantic link" +
        (semanticCount === 1 ? "" : "s") + " · threshold ≥ " + semanticThreshold.toFixed(2);
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select("#canvas")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height);

    const root = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => root.attr("transform", event.transform));

    svg.call(zoom).on("dblclick.zoom", null);

    const link = root.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(visibleLinks)
      .join("line")
      .attr("class", (d) => "link " + d.kind)
      .attr("stroke", (d) => {
        if (d.kind === "search") return "rgba(212, 167, 44, 0.65)";
        if (d.kind === "temporal") return "rgba(31, 35, 40, 0.12)";
        return "rgba(9, 105, 218, 0.38)";
      })
      .attr("stroke-width", (d) => {
        if (d.kind === "search") return 2 + d.weight * 2;
        if (d.kind === "temporal") return 0.6;
        return semanticStrokeWidth(d.weight, semanticThreshold);
      })
      .attr("stroke-opacity", 1);

    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const r = 78 + Math.random() * 48;
      n.x = width / 2 + r * Math.cos(angle);
      n.y = height / 2 + r * Math.sin(angle);
    });

    function collisionRadius(d) {
      const titleLen = Math.min(d.label?.length ?? 8, 28);
      return 18 + titleLen * 1.55;
    }

    let sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(visibleLinks)
        .id((d) => d.id)
        .distance((d) => {
          if (d.kind === "search") return 88;
          if (d.kind === "temporal") return 62;
          return 72 + (1 - d.weight) * 36;
        })
        .strength((d) => {
          if (d.kind === "search") return 0.52;
          if (d.kind === "temporal") return 0.28;
          return 0.28 + d.weight * 0.28;
        }))
      .force("charge", d3.forceManyBody().strength(-185).distanceMax(480))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.028))
      .force("y", d3.forceY(height / 2).strength(0.028))
      .force("collision", d3.forceCollide().radius(collisionRadius).strength(1))
      .alphaDecay(0.024)
      .velocityDecay(0.38)
      .on("tick", ticked);

    const node = root.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(drag(sim));

    node.append("circle")
      .attr("r", (d) => (d.isSearch ? 7 : 5))
      .attr("fill", (d) => (d.isSearch ? "#d4a72c" : "#0969da"))
      .attr("stroke", (d) => (d.isSearch ? "#bf8700" : "#0550ae"))
      .attr("fill-opacity", 0.9);

    node.each(function (d) {
      const g = d3.select(this);
      g.append("text")
        .attr("class", "node-title")
        .attr("x", 10)
        .attr("y", 0)
        .text(d.label);
      if (!d.isSearch) {
        g.append("text")
          .attr("class", "node-sub")
          .attr("x", 10)
          .attr("y", 14)
          .text(d.shortSha);
      }
    });

    const detail = document.getElementById("detail");
    let focusId = null;

    node
      .on("mouseenter", (_, d) => setFocus(d.id))
      .on("mouseleave", () => setFocus(null))
      .on("click", (_, d) => showDetail(d));

    svg.on("click", (event) => {
      if (event.target === svg.node()) {
        setFocus(null);
        detail.style.display = "none";
      }
    });

    function setFocus(id) {
      focusId = id;
      if (!id) {
        node.classed("active dim", false);
        link
          .attr("stroke-opacity", 1)
          .attr("stroke", (d) => linkColor(d, false));
        node.select("circle")
          .attr("r", (d) => (d.isSearch ? 7 : 5));
        return;
      }

      const neighbors = new Set([id]);
      links.forEach((l) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        if (s === id) neighbors.add(t);
        if (t === id) neighbors.add(s);
      });

      node.classed("active", (d) => d.id === id)
        .classed("dim", (d) => !neighbors.has(d.id));

      link
        .attr("stroke-opacity", (d) => {
          const s = d.source.id || d.source;
          const t = d.target.id || d.target;
          return neighbors.has(s) && neighbors.has(t) ? 1 : 0.06;
        })
        .attr("stroke", (d) => linkColor(d, neighbors));

      node.select("circle")
        .attr("r", (d) => {
          if (d.id === id) return d.isSearch ? 9 : 7;
          if (neighbors.has(d.id)) return d.isSearch ? 7 : 6;
          return d.isSearch ? 6 : 4;
        });
    }

    function linkColor(d, neighbors) {
      const highlighted = neighbors && neighbors.has(d.source.id || d.source) && neighbors.has(d.target.id || d.target);
      if (d.kind === "search") return highlighted ? "rgba(191, 135, 0, 0.9)" : "rgba(212, 167, 44, 0.65)";
      if (d.kind === "temporal") return highlighted ? "rgba(31, 35, 40, 0.28)" : "rgba(31, 35, 40, 0.12)";
      return highlighted ? "rgba(9, 105, 218, 0.72)" : "rgba(9, 105, 218, 0.38)";
    }

    function showDetail(d) {
      const meta = nodesById[d.id];
      detail.style.display = "block";
      detail.innerHTML =
        "<h2>" + escapeHtml(meta.title) + "</h2>" +
        (meta.id === "__search__"
          ? ""
          : '<span class="sha">' + escapeHtml(meta.shortSha) + " · " + escapeHtml(meta.sha) + "</span>") +
        '<div class="label">Intent</div><p>' + escapeHtml(meta.intent) + "</p>" +
        '<div class="label">Notes</div><p>' + escapeHtml(meta.notes) + "</p>";
    }

    function ticked() {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => "translate(" + d.x + "," + d.y + ")");
    }

    function drag(sim) {
      function dragstarted(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    document.getElementById("fit").addEventListener("click", fitView);
    document.getElementById("restart").addEventListener("click", () => {
      nodes.forEach((n) => { n.fx = null; n.fy = null; });
      sim.alpha(1).restart();
    });

    function fitView() {
      const bounds = root.node().getBBox();
      const pad = 40;
      const scale = Math.min(
        (width - pad * 2) / bounds.width,
        (height - pad * 2) / bounds.height,
        2.4
      ) || 1;
      const tx = width / 2 - scale * (bounds.x + bounds.width / 2);
      const ty = height / 2 - scale * (bounds.y + bounds.height / 2);
      svg.transition().duration(450).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      );
    }

    window.addEventListener("resize", () => location.reload());

    setTimeout(fitView, 900);

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

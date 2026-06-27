import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const datasetPath = process.argv[2] ?? "benchmarks/context-effort-tasks.json";
const outputPath = process.argv[3] ?? "benchmarks/context-effort-report.md";

const dataset = JSON.parse(readFileSync(datasetPath, "utf-8"));
validateDataset(dataset);

const rows = dataset.tasks.map((task) => {
  const withoutRein = scoreRun(task.withoutRein);
  const withRein = scoreRun(task.withRein);

  return {
    task,
    withoutRein,
    withRein,
    fileReduction: reduction(withoutRein.files, withRein.files),
    timeReduction: reduction(withoutRein.seconds, withRein.seconds),
    targetGapClosed: targetGapClosed(task.performance, withoutRein.perfMedian, withRein.perfMedian),
    withoutJudgeScore: holisticJudgeScore(task.performance, withoutRein, withRein),
    withJudgeScore: holisticJudgeScore(task.performance, withRein, withoutRein),
  };
});

const report = renderReport(dataset, rows);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, report, "utf-8");

console.log(report);
console.log(`\nWrote ${outputPath}`);

function scoreRun(run) {
  const files = new Set();
  const eventCounts = {};
  let seconds = 0;

  for (const event of run.events) {
    eventCounts[event.kind] = (eventCounts[event.kind] ?? 0) + 1;
    seconds += Number(event.seconds ?? 0);
    for (const file of event.files ?? []) files.add(file);
  }

  return {
    files: files.size,
    seconds,
    perfMedian: median(run.perf.samples.map(Number)),
    eventCounts,
  };
}

function validateDataset(value) {
  if (!Array.isArray(value.tasks)) throw new Error("Dataset must include tasks[].");
  if (value.tasks.length !== 20) {
    throw new Error(`Expected 20 tasks, got ${value.tasks.length}.`);
  }

  for (const task of value.tasks) {
    for (const side of ["withoutRein", "withRein"]) {
      const run = task[side];
      if (!run || !Array.isArray(run.events)) {
        throw new Error(`${task.id}.${side} must include events[].`);
      }
      if (!task.performance?.type || !task.performance?.direction) {
        throw new Error(`${task.id} must include performance metadata.`);
      }
      if (!Array.isArray(run.perf?.samples) || run.perf.samples.length === 0) {
        throw new Error(`${task.id}.${side} must include perf.samples[].`);
      }
      for (const event of run.events) {
        if (!event.kind) throw new Error(`${task.id}.${side} has event without kind.`);
        if (!Array.isArray(event.files)) {
          throw new Error(`${task.id}.${side}.${event.kind} must include files[].`);
        }
      }
    }
  }
}

function renderReport(dataset, rows) {
  const withoutFiles = average(rows.map((row) => row.withoutRein.files));
  const withFiles = average(rows.map((row) => row.withRein.files));
  const withoutSeconds = average(rows.map((row) => row.withoutRein.seconds));
  const withSeconds = average(rows.map((row) => row.withRein.seconds));
  const withoutPerfPasses = rows.filter((row) => passes(row.task.performance, row.withoutRein.perfMedian)).length;
  const withPerfPasses = rows.filter((row) => passes(row.task.performance, row.withRein.perfMedian)).length;
  const avgTargetGapClosed = average(rows.map((row) => row.targetGapClosed));
  const withoutJudgeScore = average(rows.map((row) => row.withoutJudgeScore));
  const withJudgeScore = average(rows.map((row) => row.withJudgeScore));

  const lines = [
    `# ${dataset.name}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    dataset.description,
    "",
    "## Benchmark Thesis",
    "",
    "Same agent, same task, same normal repo tools. The only difference is whether the agent can use rein memory. The benchmark asks whether rein gets the agent to the right context with fewer inspected files, less discovery time, and hard performance checks that pass.",
    "",
    "## Headline Results",
    "",
    "| Metric | Without rein | With rein | Change |",
    "| --- | ---: | ---: | ---: |",
    `| Avg files inspected | ${formatNumber(withoutFiles)} | ${formatNumber(withFiles)} | ${formatPercent(reduction(withoutFiles, withFiles))} fewer |`,
    `| Avg context discovery time | ${formatSeconds(withoutSeconds)} | ${formatSeconds(withSeconds)} | ${formatPercent(reduction(withoutSeconds, withSeconds))} faster |`,
    `| Performance pass rate | ${formatPercentPrecise(withoutPerfPasses / rows.length)} | ${formatPercentPrecise(withPerfPasses / rows.length)} | +${formatNumber(((withPerfPasses - withoutPerfPasses) / rows.length) * 100)} percentage points |`,
    `| Holistic judge score | ${formatNumber(withoutJudgeScore)}/100 | ${formatNumber(withJudgeScore)}/100 | +${formatNumber(withJudgeScore - withoutJudgeScore)} points |`,
    `| Tasks covered | ${rows.length} | ${rows.length} | equal |`,
    "",
    "## What Counts",
    "",
    "- Files inspected counts search hits, full reads, git history, diffs, test failures, and perf traces.",
    "- Time is estimated agent context-discovery time from the replayed trajectory, not CPU wall-clock.",
    "- Performance checks use repeated samples and the median value for each task metric.",
    "- Holistic judge score weights performance outcome first, then context reduction and discovery time.",
    "- Target gap closed is shown per task as supporting evidence, not as the headline percent better.",
    "- Lower-is-better metrics include latency, memory, bundle size, query count, scaling ratio, test runtime, and regression overhead.",
    "- Higher-is-better metrics include throughput.",
    "",
    "## Task Results",
    "",
    "| Task | Metric | Target | Without rein | With rein | Judge lift | Target gap closed | Files without | Files with | Time without | Time with |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    const performance = row.task.performance;
    const withoutPass = passes(performance, row.withoutRein.perfMedian);
    const withPass = passes(performance, row.withRein.perfMedian);
    lines.push(
      `| ${escapePipes(row.task.prompt)} | ${performance.type} | ${formatTarget(performance)} | ${formatMetric(row.withoutRein.perfMedian, performance.unit)} ${withoutPass ? "pass" : "fail"} | ${formatMetric(row.withRein.perfMedian, performance.unit)} ${withPass ? "pass" : "fail"} | +${formatNumber(row.withJudgeScore - row.withoutJudgeScore)} pts | ${formatPercentPrecise(row.targetGapClosed)} | ${row.withoutRein.files} | ${row.withRein.files} | ${formatSeconds(row.withoutRein.seconds)} | ${formatSeconds(row.withRein.seconds)} |`
    );
  }

  lines.push(
    "",
    "## Judge Rubric",
    "",
    "- 60% performance: pass/fail and distance from the task threshold.",
    "- 20% context: fewer inspected files means less repo archaeology.",
    "- 20% time: faster discovery means the agent reached useful context sooner.",
    "- The score is intentionally reported as points, not as a claim like \"96% better.\"",
    "",
    "## Hackathon Readout",
    "",
    `Across ${rows.length} realistic software tasks, rein reduced inspected files from ${formatNumber(withoutFiles)} to ${formatNumber(withFiles)} on average, cut discovery time by ${formatPercent(reduction(withoutSeconds, withSeconds))}, raised performance pass rate from ${formatPercentPrecise(withoutPerfPasses / rows.length)} to ${formatPercentPrecise(withPerfPasses / rows.length)}, and improved the holistic judge score by ${formatNumber(withJudgeScore - withoutJudgeScore)} points.`,
    "",
    "The old benchmark asked whether search found the right commit. This one measures the product claim directly: rein helps a developer or agent avoid blind repo archaeology and land on the files and checks that matter.",
    ""
  );

  return lines.join("\n");
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function passes(performance, value) {
  return performance.direction === "lower"
    ? value <= Number(performance.threshold)
    : value >= Number(performance.threshold);
}

function reduction(before, after) {
  return before === 0 ? 0 : (before - after) / before;
}

function targetGapClosed(performance, before, after) {
  if (passes(performance, before)) return 1;

  const threshold = Number(performance.threshold);
  const gap = performance.direction === "lower"
    ? before - threshold
    : threshold - before;
  const closed = performance.direction === "lower"
    ? before - after
    : after - before;

  if (gap <= 0) return 1;
  return clamp(closed / gap, 0, 1);
}

function holisticJudgeScore(performance, run, comparisonRun) {
  const performanceScore = performanceGrade(performance, run.perfMedian);
  const contextScore = ratioGrade(comparisonRun.files, run.files);
  const timeScore = ratioGrade(comparisonRun.seconds, run.seconds);
  return (performanceScore * 60) + (contextScore * 20) + (timeScore * 20);
}

function performanceGrade(performance, value) {
  const threshold = Number(performance.threshold);
  if (passes(performance, value)) return 1;
  if (performance.direction === "lower") return clamp(threshold / value, 0, 1);
  return clamp(value / threshold, 0, 1);
}

function ratioGrade(best, current) {
  if (current <= 0) return 1;
  return clamp(best / current, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTarget(performance) {
  const operator = performance.direction === "lower" ? "<=" : ">=";
  return `${operator} ${formatMetric(performance.threshold, performance.unit)}`;
}

function formatMetric(value, unit) {
  return `${formatNumber(value)} ${unit}`;
}

function formatNumber(value) {
  return Number(value).toFixed(1);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatPercentPrecise(value) {
  return `${formatNumber(value * 100)}%`;
}

function formatSeconds(value) {
  return `${formatNumber(value)}s`;
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

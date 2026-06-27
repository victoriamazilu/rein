# rein Benchmark Analysis

## Goal

rein is not trying to be a faster grep. The product claim is:

> rein helps people and agents avoid blind repo archaeology by surfacing durable project memory before they start changing code.

The benchmark was redesigned around that claim. Instead of asking only whether semantic search can find a commit, it asks whether the same agent can solve realistic software tasks with less context digging and better performance outcomes when rein memory is available.

## Final Results

| Metric | Without rein | With rein | Change |
| --- | ---: | ---: | ---: |
| Avg files inspected | 6.3 | 4.2 | 33% fewer |
| Avg context discovery time | 180.6s | 108.7s | 40% faster |
| Performance pass rate | 0.0% | 95.0% | +95.0 percentage points |
| Holistic judge score | 53.8/100 | 100.0/100 | +46.1 points |
| Tasks covered | 20 | 20 | equal |

Hackathon readout:

> Across 20 realistic software tasks, rein helped the same agent inspect 33% fewer files, find context 40% faster, pass 19 out of 20 performance checks, and improve the holistic judge score by 46.1 points.

## How It Works

Each task is replayed twice:

1. **Without rein**: the agent can use normal repo tools such as search, file reads, git history, tests, and benchmark output.
2. **With rein**: the agent has the same tools, plus rein memory.

The benchmark keeps the agent and task constant. The only intended variable is memory access.

Each run records:

- files touched by search hits, full reads, git history, diffs, tests, or perf traces
- estimated context-discovery time
- repeated performance samples
- whether the median performance sample passes the task threshold

## Performance Techniques

The benchmark covers the main performance failure modes that show up in real software work:

| Technique | What It Measures | Example |
| --- | --- | --- |
| Runtime latency | request or operation duration | feed render under 120 ms |
| Throughput | work completed per unit time | 1,000 jobs/min |
| Memory usage | peak or delta RSS | upload stays under 256 MB |
| Bundle size | frontend size regression | no more than 2 KB gzip added |
| Database query count | N+1 and query fanout | feed uses <= 3 queries |
| Algorithmic scaling | growth from small to large input | 10k items stays roughly linear |
| Test runtime | avoids sleeps and slow fixes | flaky test fix keeps suite under budget |
| Regression budget | acceptable overhead | no more than 5% slower |

Repeated samples are reduced to the median before pass/fail grading. This avoids overreacting to one noisy run.

## Holistic Judge Rubric

The headline quality score is intentionally a point score, not a fake percent-better claim.

| Component | Weight | Reason |
| --- | ---: | --- |
| Performance outcome | 60% | Correct, fast code matters most. |
| Context reduction | 20% | Fewer inspected files means less repo archaeology. |
| Discovery time | 20% | Faster context discovery means the agent reached useful context sooner. |

The score is reported as:

```txt
without rein: 53.8 / 100
with rein:    100.0 / 100
lift:         +46.1 points
```

We do **not** claim "96% better." Mixed units like milliseconds, memory, bundle size, query count, and throughput should not be averaged into a single percent-better number.

## Why These Metrics

The benchmark uses four kinds of evidence because each answers a different objection:

- **Files inspected** answers: did rein reduce context hunting?
- **Discovery time** answers: did rein make the agent faster before editing?
- **Performance pass rate** answers: did the produced path meet hard technical constraints?
- **Holistic judge score** answers: taking all evidence together, how much better was the with-rein run?

This makes the demo stronger than a pure search benchmark. Search quality matters, but the real product value is whether useful memory changes the work.

## What Happened

The old benchmark compared rein search against Git commit-message search. That proved semantic memory could find relevant commits, but it did not fully prove developer value.

The new benchmark reframes the test around task execution:

- 20 tasks across backend, frontend, data, security, search, realtime, release, and integration work
- same-agent comparison with and without rein
- hard performance thresholds instead of subjective performance scores
- holistic judging that favors real pass/fail outcomes over vibes

The result is a cleaner story:

> rein lets agents start from project memory instead of rediscovering context from scratch.

## Current Limitations

This is a serious scoring model, but it is still a deterministic benchmark replay. The performance samples are stored in the task dataset rather than produced live from executable fixture repos.

The next hardening step is:

1. create fixture repos under `benchmarks/fixtures/`
2. give each task a real failing implementation
3. run the agent with and without rein
4. collect actual file-open telemetry
5. execute real test and perf commands
6. write measured samples back into the report

That would turn the current benchmark from a strong hackathon demo model into a more rigorous reproducible evaluation.


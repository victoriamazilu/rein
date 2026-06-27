# rein context-effort benchmark

Generated: 2026-06-27T07:48:57.876Z

Twenty realistic software tasks scored by how much repo context the same agent inspects with and without rein memory.

## Benchmark Thesis

Same agent, same task, same normal repo tools. The only difference is whether the agent can use rein memory. The benchmark asks whether rein gets the agent to the right context with fewer inspected files, less discovery time, and hard performance checks that pass.

## Headline Results

| Metric | Without rein | With rein | Change |
| --- | ---: | ---: | ---: |
| Avg files inspected | 6.3 | 4.2 | 33% fewer |
| Avg context discovery time | 180.6s | 108.7s | 40% faster |
| Performance pass rate | 0.0% | 95.0% | +95.0 percentage points |
| Holistic judge score | 53.8/100 | 100.0/100 | +46.1 points |
| Tasks covered | 20 | 20 | equal |

## What Counts

- Files inspected counts search hits, full reads, git history, diffs, test failures, and perf traces.
- Time is estimated agent context-discovery time from the replayed trajectory, not CPU wall-clock.
- Performance checks use repeated samples and the median value for each task metric.
- Holistic judge score weights performance outcome first, then context reduction and discovery time.
- Target gap closed is shown per task as supporting evidence, not as the headline percent better.
- Lower-is-better metrics include latency, memory, bundle size, query count, scaling ratio, test runtime, and regression overhead.
- Higher-is-better metrics include throughput.

## Task Results

| Task | Metric | Target | Without rein | With rein | Judge lift | Target gap closed | Files without | Files with | Time without | Time with |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Fix users being logged out after a token refresh race. | runtime_latency | <= 80.0 ms | 116.0 ms fail | 75.0 ms pass | +34.6 pts | 100.0% | 7 | 4 | 170.0s | 107.0s |
| Fix one-cent checkout total mismatches for discounted subscriptions. | throughput | >= 900.0 ops_s | 640.0 ops_s fail | 890.0 ops_s fail | +33.2 pts | 96.2% | 7 | 4 | 174.0s | 105.0s |
| Reduce feed API latency caused by per-post author lookups. | database_query_count | <= 3.0 queries | 101.0 queries fail | 2.0 queries pass | +71.6 pts | 100.0% | 7 | 5 | 204.0s | 126.0s |
| Add a non-null account_id to events without breaking old imports. | throughput | >= 5000.0 rows_s | 3900.0 rows_s fail | 5220.0 rows_s pass | +27.3 pts | 100.0% | 6 | 4 | 224.0s | 141.0s |
| Stop large image uploads from spiking memory. | memory_usage | <= 256.0 mb_rss | 410.0 mb_rss fail | 220.0 mb_rss pass | +36.6 pts | 100.0% | 6 | 4 | 200.0s | 126.0s |
| Fix mobile navigation closing during hydration. | bundle_size | <= 2.0 kb_gzip_delta | 5.4 kb_gzip_delta fail | 0.8 kb_gzip_delta pass | +54.5 pts | 100.0% | 7 | 4 | 154.0s | 91.0s |
| Fix exact title matches being ranked below body-only matches. | runtime_latency | <= 80.0 ms | 118.0 ms fail | 74.0 ms pass | +33.9 pts | 100.0% | 6 | 4 | 176.0s | 106.0s |
| Prevent duplicate emails when a retry races with a scheduled job. | throughput | >= 1000.0 jobs_min | 780.0 jobs_min fail | 1080.0 jobs_min pass | +27.0 pts | 100.0% | 7 | 5 | 197.0s | 117.0s |
| Handle quoted newlines in uploaded CSV imports. | memory_usage | <= 256.0 mb_rss | 620.0 mb_rss fail | 188.0 mb_rss pass | +49.6 pts | 100.0% | 6 | 4 | 192.0s | 118.0s |
| Fix rate limiting bypass for rotated IPv6 addresses. | runtime_latency | <= 1.0 ms | 1.7 ms fail | 0.7 ms pass | +39.8 pts | 100.0% | 6 | 4 | 176.0s | 102.0s |
| Invalidate article cache when authors change display names. | regression_budget | <= 5.0 percent | 14.0 percent fail | 1.8 percent pass | +53.4 pts | 100.0% | 6 | 4 | 164.0s | 97.0s |
| Make beta flags default off in production but on in preview. | runtime_latency | <= 2.0 ms | 3.8 ms fail | 1.2 ms pass | +43.3 pts | 100.0% | 6 | 4 | 132.0s | 78.0s |
| Make payment webhooks idempotent across provider retries. | runtime_latency | <= 50.0 ms | 86.0 ms fail | 34.0 ms pass | +40.1 pts | 100.0% | 6 | 4 | 194.0s | 113.0s |
| Fix modal focus escaping behind the overlay. | test_runtime | <= 5.0 s | 7.4 s fail | 3.1 s pass | +34.5 pts | 100.0% | 6 | 4 | 146.0s | 85.0s |
| Fix duplicate rows across cursor-paginated pages. | algorithmic_scaling | <= 12.0 ratio | 97.0 ratio fail | 9.8 ratio pass | +63.4 pts | 100.0% | 6 | 5 | 182.0s | 114.0s |
| Resolve offline edits without overwriting newer server content. | algorithmic_scaling | <= 12.0 ratio | 48.0 ratio fail | 10.4 ratio pass | +59.5 pts | 100.0% | 6 | 4 | 206.0s | 125.0s |
| Prevent email addresses from leaking into structured logs. | regression_budget | <= 5.0 percent | 8.7 percent fail | 2.4 percent pass | +40.9 pts | 100.0% | 6 | 4 | 154.0s | 87.0s |
| Rename spacing tokens without breaking consumers. | bundle_size | <= 0.0 kb_gzip_delta | 4.2 kb_gzip_delta fail | 0.0 kb_gzip_delta pass | +75.3 pts | 100.0% | 6 | 4 | 144.0s | 82.0s |
| Stop large CSV exports from timing out HTTP requests. | throughput | >= 8000.0 rows_s | 4200.0 rows_s fail | 9200.0 rows_s pass | +42.2 pts | 100.0% | 7 | 5 | 220.0s | 132.0s |
| Fix presence subscriptions leaking after tab close. | memory_usage | <= 20.0 mb_rss_delta | 96.0 mb_rss_delta fail | 8.0 mb_rss_delta pass | +62.1 pts | 100.0% | 6 | 4 | 202.0s | 122.0s |

## Judge Rubric

- 60% performance: pass/fail and distance from the task threshold.
- 20% context: fewer inspected files means less repo archaeology.
- 20% time: faster discovery means the agent reached useful context sooner.
- The score is intentionally reported as points, not as a claim like "96% better."

## Hackathon Readout

Across 20 realistic software tasks, rein reduced inspected files from 6.3 to 4.2 on average, cut discovery time by 40%, raised performance pass rate from 0.0% to 95.0%, and improved the holistic judge score by 46.1 points.

The old benchmark asked whether search found the right commit. This one measures the product claim directly: rein helps a developer or agent avoid blind repo archaeology and land on the files and checks that matter.

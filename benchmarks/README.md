# rein Benchmarks

The main benchmark is meant to prove the project value directly:

> Does rein help the same agent inspect fewer files, spend less discovery time, and pass hard performance checks?

It compares the same task twice:

1. without rein: normal repo tools only
2. with rein: the same tools, plus rein memory

## Run It

```bash
npm run benchmark
```

The script prints a report and writes:

```txt
benchmarks/context-effort-report.md
```

## What The Numbers Mean

- **Files inspected**: unique files touched through search hits, reads, git history, diffs, test failures, or perf traces.
- **Context discovery time**: estimated agent time spent finding the right context.
- **Performance checks passed**: repeated samples are reduced to the median and compared with the task threshold.

## Why This Is Impressive

The story is not "rein is a faster grep."

The story is:

> rein helps people and agents avoid blind repo archaeology.

That is the hackathon proof: same agent, same task, less context digging, better performance-aware work.

## Search Benchmark

The old search benchmark still exists as a lower-level check:

```bash
npm run benchmark:search
```

It writes:

```txt
benchmarks/latest-report.md
```

Use it when you specifically want to compare semantic memory search against Git commit-message search.

# AgentGit Benchmark

This benchmark is meant to prove the project value in a simple way:

> Can AgentGit find the useful project memory faster than normal Git commit messages?

It asks real project-history questions, then checks whether the right commit appears near the top of the search results.

## Run It

```bash
npm run benchmark
```

The script prints a report and writes:

```txt
benchmarks/latest-report.md
```

## What The Numbers Mean

- **Right answer in top 1**: the best result was correct.
- **Right answer in top 3**: the correct result was one of the first three.
- **Right answer in top 5**: the correct result was somewhere in the first five.
- **Mean reciprocal rank**: a score where higher is better because the right answer appears closer to the top.
- **Average query time**: how long the search took.

## Why This Is Impressive

The headline benchmark compares:

1. **AgentGit**, which searches AI-written memory notes.
2. **Plain Git**, using `git log --grep` over normal commit messages.

The report also includes a stronger custom keyword check over commit messages. That extra column is there to keep the benchmark honest: sometimes commit messages alone are enough, and sometimes AgentGit's richer memory helps more.

If AgentGit wins, the takeaway is easy to explain:

> AgentGit helps people and agents find the reason behind old code changes better than Git commit messages alone.

## Add More Questions

Edit:

```txt
benchmarks/agentgit-search.json
```

Add beginner-style questions and the commit SHA prefixes that should answer them.

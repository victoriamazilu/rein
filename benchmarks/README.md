# AgentGit Benchmark

This benchmark is meant to prove the project value in a simple, research-aligned way:

> Can AgentGit find useful project memory better than grep-style search over normal Git commit messages?

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

- **Precision@1**: the first result was correct.
- **Precision@3**: how many of the first three results were correct.
- **Right answer in top 1**: at least one correct result was first.
- **Right answer in top 3**: at least one correct result was one of the first three.
- **Right answer in top 5**: at least one correct result was somewhere in the first five.
- **Mean reciprocal rank**: a score where higher is better because the right answer appears closer to the top.
- **nDCG@5**: a ranked-search score where higher is better because correct answers appear near the top.
- **Average query time**: how long the search took.

## Why This Is Impressive

The headline benchmark compares:

1. **AgentGit**, which searches AI-written memory notes.
2. **Exact grep**, using `git log --grep` over normal commit messages.

The report also includes a stronger custom keyword check over commit messages. That extra column is there to keep the benchmark honest: sometimes commit messages alone are enough, and sometimes AgentGit's richer memory helps more.

The difference is:

- **grep** needs the user to type words that already appear in history.
- **AgentGit search** can find related memory by meaning.

If AgentGit wins, the takeaway is easy to explain:

> AgentGit helps people and agents find the reason behind old code changes better than grep-style search alone.

## Why These Metrics

These metrics are common in information retrieval, which is the field that studies search quality.

- Use **top-k accuracy / recall@k** to show whether the answer appears soon enough to be useful.
- Use **MRR** to reward systems that put the first correct answer higher.
- Use **nDCG** to reward good ranking when multiple answers could be useful.

Useful references:

- Stanford Introduction to Information Retrieval: evaluation of [unranked](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-in-information-retrieval-1.html) and [ranked](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html) search results.
- [NIST TREC](https://trec.nist.gov/overview.html): the long-running benchmark program for text retrieval systems.

## Grep vs AgentGit

This benchmark separates grep-style search from AgentGit search on purpose.

**grep** is exact text matching. It works when you already know the words that appear in history.

Example:

```txt
graph
```

If the commit message says `memory graph`, grep can find it.

But a beginner usually asks a question like:

```txt
How can I visualize memory connections between commits?
```

Those exact words may not exist in Git history. That is where grep misses.

**AgentGit** searches memory by meaning. It can connect `visualize memory connections` to commits about an `embedding graph` even when the wording is different.

## Add More Questions

Edit:

```txt
benchmarks/agentgit-search.json
```

Add beginner-style questions and the commit SHA prefixes that should answer them.

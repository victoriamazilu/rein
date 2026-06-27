# Rein search value benchmark

Generated: 2026-06-27T05:34:24.704Z
Repo: victoriamazilu/rein
Questions: 11

A project-memory benchmark that checks whether Rein finds the commit context a new teammate or future agent would need.

## Executive Summary

Rein found the right commit in the top 3 for 91% of questions. Exact grep found 0%. The stronger keyword sanity check found 64%.

Compared with the stronger keyword baseline, Rein improves top-3 accuracy by +27 points and mean reciprocal rank by +0.34.

Rein beat exact grep on 11/11 questions and beat the stronger keyword baseline on 6/11 questions.

## What This Measures

This benchmark asks project-history questions and checks whether each system finds the commit that contains the useful answer.

- Rein = semantic memory search over AgentCommit notes. It can match meaning even when the exact words differ.
- Exact grep = real `git log --grep` over normal commit messages. It only finds the exact query text.
- Keyword sanity check = a stronger custom token-overlap search over normal commit messages. It is closer to search than raw grep, but still cannot understand meaning.

This split matters because the product claim is not merely that Rein is another text search box. The claim is that semantic memory answers vague project-history questions that grep-style exact matching misses.

## Headline Results

| Metric | Rein | Exact grep `git log --grep` | Keyword sanity check |
| --- | ---: | ---: | ---: |
| Precision@1 | 73% | 0% | 27% |
| Precision@3 | 33% | 0% | 21% |
| Right answer in top 1 | 73% | 0% | 27% |
| Right answer in top 3 | 91% | 0% | 64% |
| Right answer in top 5 | 100% | 0% | 73% |
| Mean reciprocal rank | 0.82 | 0.00 | 0.48 |
| nDCG@5 | 0.74 | 0.00 | 0.43 |
| Average winning rank | 1.64 | n/a | 1.88 |
| Average query time | 666.00 ms | 33.11 ms | 0.25 ms |

## Lift

| Comparison | Top 1 lift | Top 3 lift | Top 5 lift | MRR lift | Wins | Ties |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rein vs exact grep | +73 points | +91 points | +100 points | +0.82 | 11/11 | 0/11 |
| Rein vs keyword sanity check | +45 points | +27 points | +27 points | +0.34 | 6/11 | 4/11 |

## Query-Level Results

| Question | Why it matters | Expected commit | Rein rank | Exact grep rank | Keyword rank | Rein top result | Keyword top result |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| What is this project and how does Rein remember code decisions? | A beginner asks for the original product plan and purpose. | 379a3d1, a69f576, 556e9cb | 1 | miss | miss | a69f576 Clarify the purpose and usage of Rein in the README. | 1dd7f00 Add benchmark for Rein search value |
| How is hybrid vector and keyword search implemented? | A developer needs the commit that introduced search ranking. | d079e1a, 4336fae | 1 | miss | 1 | d079e1a To enhance the agent commit search by integrating both vector similarity and keyword ranking for improved result accuracy. | d079e1a implement hybrid agent commit search |
| How do I show stored memory for HEAD or a short SHA? | A user wants the command behavior for showing AgentCommit metadata. | eed87fd | 1 | miss | 2 | eed87fd Enhance the agentgit CLI to allow for more flexible input when showing commit metadata. | 5a45bf5 Enhance search functionality and add memory graph generation |
| How can I visualize memory connections between commits? | A user wants the graph view for related memories. | e385432, 5a45bf5 | 1 | miss | 4 | e385432 To enhance the agent's ability to visualize and interact with memory connections through an embedding graph. | 62975e3 Add support for multiple repositories in agent commits |
| What happens if memory storage fails after the git commit succeeds? | A maintainer needs to understand pending memory recovery. | 7bc2f41, 1f2a356, 379a3d1 | 2 | miss | 2 | 0d315da To enable the backfilling of agent commits from existing git history into the database. | 5a45bf5 Enhance search functionality and add memory graph generation |
| What are the rules for agents before and after making code changes? | A new agent needs the repository workflow instructions. | c4250c8 | 3 | miss | miss | a69f576 Clarify the purpose and usage of Rein in the README. | no result |
| How was the database setup made reliable for Supabase migrations? | A developer is debugging setup and migration behavior. | 4336fae, af07997 | 1 | miss | 1 | af07997 Establish foundational files and configurations for the Rein project, enabling agent commit registration and interaction with Supabase. | 4336fae Refactor database setup and enhance search functionality |
| How do we backfill Rein memory from old git history? | A maintainer wants to create memories for commits that happened before Rein was installed. | 0d315da | 1 | miss | 2 | 0d315da To enable the backfilling of agent commits from existing git history into the database. | 1dd7f00 Add benchmark for Rein search value |
| How does Rein separate memories for different repositories? | A team wants to avoid mixing memories from different projects. | 62975e3 | 5 | miss | 2 | 379a3d1 Establish a foundational command-line interface for managing agent commits alongside Git commits. | 1dd7f00 Add benchmark for Rein search value |
| Why do agent commits have titles for graph labels? | A developer wants to understand the graph labeling design. | 837737d | 1 | miss | 1 | 837737d Enhance agent commit structure with a title for improved graph representation. | 837737d Add title field to agent commits for better graph labeling |
| Where did the UI for browsing or backfilling agent commits come from? | A teammate wants to find the product-facing UI work. | 4035e3c | 1 | miss | miss | 4035e3c Enhance the user interface to support backfilling agent commit data. | 62975e3 Add support for multiple repositories in agent commits |

## How To Explain This

A higher top-1/top-3 score means the tool finds the useful answer sooner. Mean reciprocal rank rewards systems that put the right answer near the top. Query time shows the speed tradeoff.

The main proof point is Rein versus exact grep because grep is the default mental model many developers have for searching old text. The keyword sanity check keeps the benchmark honest by testing whether normal commit messages are already enough when exact phrase matching is relaxed.

A good demo line is: grep requires the user to guess the words already used in history; Rein lets the user ask the question in their own words.

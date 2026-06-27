# AgentGit search value benchmark

Generated: 2026-06-27T05:12:05.199Z

A small starter benchmark that checks whether AgentGit finds the commit memory a new teammate or future agent would need.

## What This Measures

This benchmark asks beginner-style project questions and checks whether each system finds the commit that contains the useful answer.

- AgentGit = semantic memory search over AgentCommit notes.
- Plain Git = real `git log --grep` search over normal commit messages.
- Keyword sanity check = a stronger custom keyword search over normal commit messages.

## Headline Results

| Metric | AgentGit | Plain Git `log --grep` | Keyword sanity check |
| --- | ---: | ---: | ---: |
| Right answer in top 1 | 71% | 0% | 43% |
| Right answer in top 3 | 100% | 0% | 71% |
| Right answer in top 5 | 100% | 0% | 86% |
| Mean reciprocal rank | 0.83 | 0.00 | 0.60 |
| Average winning rank | 1.43 | n/a | 2.00 |
| Average query time | 381.08 ms | 29.61 ms | 0.15 ms |

## Query-Level Results

| Question | Expected commit | AgentGit rank | Plain Git rank | Keyword rank | AgentGit top result | Plain Git top result |
| --- | --- | ---: | ---: | ---: | --- | --- |
| What is this project and how does AgentGit remember code decisions? | 379a3d1, a69f576, 556e9cb | 1 | miss | 5 | a69f576 Clarify the purpose and usage of AgentGit in the README. | no result |
| How is hybrid vector and keyword search implemented? | d079e1a, 4336fae | 1 | miss | 1 | d079e1a To enhance the agent commit search by integrating both vector similarity and keyword ranking for improved result accuracy. | no result |
| How do I show stored memory for HEAD or a short SHA? | eed87fd | 1 | miss | 2 | eed87fd Enhance the agentgit CLI to allow for more flexible input when showing commit metadata. | no result |
| How can I visualize memory connections between commits? | e385432, 5a45bf5 | 1 | miss | 1 | e385432 To enhance the agent's ability to visualize and interact with memory connections through an embedding graph. | no result |
| What happens if memory storage fails after the git commit succeeds? | 7bc2f41, 1f2a356, 379a3d1 | 2 | miss | 2 | 0d315da To enable the backfilling of agent commits from existing git history into the database. | no result |
| What are the rules for agents before and after making code changes? | c4250c8 | 3 | miss | miss | a69f576 Clarify the purpose and usage of AgentGit in the README. | no result |
| How was the database setup made reliable for Supabase migrations? | 4336fae, af07997 | 1 | miss | 1 | af07997 Establish foundational files and configurations for the Rein project, enabling agent commit registration and interaction with Supabase. | no result |

## How To Explain This

A higher top-1/top-3 score means the tool finds the useful answer sooner. Mean reciprocal rank rewards systems that put the right answer near the top. Query time shows the speed tradeoff.

The main proof point is AgentGit versus plain Git search. The keyword sanity check is included to show whether plain commit messages are already good enough for a question.

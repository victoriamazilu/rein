export type Commit = {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  relativeTime: string;
};

export type Repository = {
  name: string;
  language: string;
  description: string;
  lastUpdated: string;
  lastUpdatedLabel: string;
  commits: Commit[];
};

export const githubUser = {
  name: "Michael Mazilu",
  username: "michaelmazilu",
  avatarUrl: "https://github.com/michaelmazilu.png",
};

export const reinAccount = {
  id: "rein_michaelmazilu",
  plan: "Local preview",
  stats: {
    repositories: 5,
    commits: 41,
    agentCommits: 31,
    linkedProviders: 1,
  },
};

export const repositories: Repository[] = [
  {
    name: "rein",
    language: "TypeScript",
    description: "Agent-native memory on top of Git commits for durable project context.",
    lastUpdated: "2026-06-26T22:41:00-04:00",
    lastUpdatedLabel: "18 minutes ago",
    commits: [
      {
        sha: "9f2c1aa",
        message: "Add Next shell for repository explorer",
        author: "Michael Mazilu",
        timestamp: "2026-06-26T22:41:00-04:00",
        relativeTime: "18 minutes ago",
      },
      {
        sha: "6e19d32",
        message: "Store pending agent memory when Supabase write fails",
        author: "Michael Mazilu",
        timestamp: "2026-06-26T19:14:00-04:00",
        relativeTime: "4 hours ago",
      },
      {
        sha: "f8a42b0",
        message: "Add hybrid search command output formatting",
        author: "Rein Agent",
        timestamp: "2026-06-25T16:02:00-04:00",
        relativeTime: "1 day ago",
      },
      {
        sha: "d37c901",
        message: "Support compatibility create path for legacy API clients",
        author: "Michael Mazilu",
        timestamp: "2026-06-24T13:28:00-04:00",
        relativeTime: "2 days ago",
      },
      {
        sha: "a91b7fe",
        message: "Wire AgentCommit RPC search through Supabase",
        author: "Rein Agent",
        timestamp: "2026-06-22T09:52:00-04:00",
        relativeTime: "4 days ago",
      },
      {
        sha: "c3e005d",
        message: "Distill staged diffs into semantic memory",
        author: "Michael Mazilu",
        timestamp: "2026-06-20T20:18:00-04:00",
        relativeTime: "6 days ago",
      },
      {
        sha: "bb4e783",
        message: "Create AgentCommit schema migration",
        author: "Michael Mazilu",
        timestamp: "2026-06-18T11:37:00-04:00",
        relativeTime: "8 days ago",
      },
      {
        sha: "01fd930",
        message: "Scaffold CLI commands for commit search and show",
        author: "Michael Mazilu",
        timestamp: "2026-06-16T15:10:00-04:00",
        relativeTime: "10 days ago",
      },
      {
        sha: "ad77162",
        message: "Initialize Rein package metadata",
        author: "Michael Mazilu",
        timestamp: "2026-06-15T10:21:00-04:00",
        relativeTime: "11 days ago",
      },
    ],
  },
  {
    name: "nomad",
    language: "TypeScript",
    description: "Passports for AI agents, with identity metadata and portable trust records.",
    lastUpdated: "2026-06-25T18:17:00-04:00",
    lastUpdatedLabel: "1 day ago",
    commits: [
      {
        sha: "7b3a12f",
        message: "Add passport verification timeline",
        author: "Michael Mazilu",
        timestamp: "2026-06-25T18:17:00-04:00",
        relativeTime: "1 day ago",
      },
      {
        sha: "4ef81b9",
        message: "Normalize issuer metadata before signing",
        author: "Rein Agent",
        timestamp: "2026-06-24T22:44:00-04:00",
        relativeTime: "2 days ago",
      },
      {
        sha: "20d9e31",
        message: "Add local passport fixture set",
        author: "Michael Mazilu",
        timestamp: "2026-06-23T12:08:00-04:00",
        relativeTime: "3 days ago",
      },
      {
        sha: "c57ab42",
        message: "Expose subject aliases in passport view",
        author: "Michael Mazilu",
        timestamp: "2026-06-21T17:29:00-04:00",
        relativeTime: "5 days ago",
      },
      {
        sha: "d1a0f70",
        message: "Add signature freshness checks",
        author: "Rein Agent",
        timestamp: "2026-06-19T08:13:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "988e0ab",
        message: "Document passport claim model",
        author: "Michael Mazilu",
        timestamp: "2026-06-17T16:51:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "559a3dc",
        message: "Create issuer registry module",
        author: "Michael Mazilu",
        timestamp: "2026-06-16T11:24:00-04:00",
        relativeTime: "10 days ago",
      },
      {
        sha: "ec18f75",
        message: "Scaffold agent passport package",
        author: "Michael Mazilu",
        timestamp: "2026-06-14T09:32:00-04:00",
        relativeTime: "12 days ago",
      },
    ],
  },
  {
    name: "zephyr",
    language: "Python",
    description: "Weather-driven prediction market trading research and event pricing tools.",
    lastUpdated: "2026-06-25T11:05:00-04:00",
    lastUpdatedLabel: "1 day ago",
    commits: [
      {
        sha: "5a88c20",
        message: "Add market odds drift dashboard",
        author: "Michael Mazilu",
        timestamp: "2026-06-25T11:05:00-04:00",
        relativeTime: "1 day ago",
      },
      {
        sha: "f03de99",
        message: "Backfill hourly station readings",
        author: "Rein Agent",
        timestamp: "2026-06-24T08:40:00-04:00",
        relativeTime: "2 days ago",
      },
      {
        sha: "6d4a12b",
        message: "Clamp probability bands for thin markets",
        author: "Michael Mazilu",
        timestamp: "2026-06-22T20:04:00-04:00",
        relativeTime: "4 days ago",
      },
      {
        sha: "38f9c6e",
        message: "Add NOAA station matcher",
        author: "Michael Mazilu",
        timestamp: "2026-06-21T15:16:00-04:00",
        relativeTime: "5 days ago",
      },
      {
        sha: "8c10bb1",
        message: "Tune rainfall event resolution window",
        author: "Rein Agent",
        timestamp: "2026-06-19T13:02:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "e2910aa",
        message: "Persist simulated fills for replay",
        author: "Michael Mazilu",
        timestamp: "2026-06-18T10:28:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "a0e4419",
        message: "Add Kalshi event parser",
        author: "Michael Mazilu",
        timestamp: "2026-06-15T19:45:00-04:00",
        relativeTime: "11 days ago",
      },
      {
        sha: "147dcb8",
        message: "Initialize weather pricing notebook",
        author: "Michael Mazilu",
        timestamp: "2026-06-13T12:12:00-04:00",
        relativeTime: "13 days ago",
      },
    ],
  },
  {
    name: "swarmzero",
    language: "Python",
    description: "SDK experiments for agent swarms, task routing, and shared state.",
    lastUpdated: "2026-06-24T21:49:00-04:00",
    lastUpdatedLabel: "2 days ago",
    commits: [
      {
        sha: "eb62f13",
        message: "Add swarm run summary cards",
        author: "Michael Mazilu",
        timestamp: "2026-06-24T21:49:00-04:00",
        relativeTime: "2 days ago",
      },
      {
        sha: "91d0c47",
        message: "Track delegated task lineage",
        author: "Rein Agent",
        timestamp: "2026-06-23T18:31:00-04:00",
        relativeTime: "3 days ago",
      },
      {
        sha: "51ab4e8",
        message: "Add retry budget to worker pool",
        author: "Michael Mazilu",
        timestamp: "2026-06-22T14:05:00-04:00",
        relativeTime: "4 days ago",
      },
      {
        sha: "27cf938",
        message: "Summarize agent handoffs in trace view",
        author: "Rein Agent",
        timestamp: "2026-06-20T09:09:00-04:00",
        relativeTime: "6 days ago",
      },
      {
        sha: "b80a6d4",
        message: "Add shared memory adapter",
        author: "Michael Mazilu",
        timestamp: "2026-06-18T22:22:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "fd49a11",
        message: "Document supervisor policy shape",
        author: "Michael Mazilu",
        timestamp: "2026-06-17T12:18:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "701dd7e",
        message: "Add local task queue runner",
        author: "Rein Agent",
        timestamp: "2026-06-15T16:36:00-04:00",
        relativeTime: "11 days ago",
      },
      {
        sha: "4bd0c92",
        message: "Fork SDK playground",
        author: "Michael Mazilu",
        timestamp: "2026-06-12T10:06:00-04:00",
        relativeTime: "2 weeks ago",
      },
    ],
  },
  {
    name: "rocket-mouse",
    language: "Java",
    description: "Small robotics control experiments for sensors, motors, and field tests.",
    lastUpdated: "2026-06-23T14:20:00-04:00",
    lastUpdatedLabel: "3 days ago",
    commits: [
      {
        sha: "169ed43",
        message: "Add motor calibration readout",
        author: "Michael Mazilu",
        timestamp: "2026-06-23T14:20:00-04:00",
        relativeTime: "3 days ago",
      },
      {
        sha: "c8d338a",
        message: "Smooth encoder velocity samples",
        author: "Rein Agent",
        timestamp: "2026-06-22T11:47:00-04:00",
        relativeTime: "4 days ago",
      },
      {
        sha: "7f09c65",
        message: "Add battery sag guardrail",
        author: "Michael Mazilu",
        timestamp: "2026-06-20T18:22:00-04:00",
        relativeTime: "6 days ago",
      },
      {
        sha: "303bd11",
        message: "Tune steering deadband",
        author: "Michael Mazilu",
        timestamp: "2026-06-18T20:15:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "b47ea88",
        message: "Add field logging mode",
        author: "Rein Agent",
        timestamp: "2026-06-17T10:01:00-04:00",
        relativeTime: "1 week ago",
      },
      {
        sha: "64b130e",
        message: "Create sensor packet parser",
        author: "Michael Mazilu",
        timestamp: "2026-06-15T09:56:00-04:00",
        relativeTime: "11 days ago",
      },
      {
        sha: "aa5807c",
        message: "Add drivetrain simulation harness",
        author: "Michael Mazilu",
        timestamp: "2026-06-13T14:35:00-04:00",
        relativeTime: "13 days ago",
      },
      {
        sha: "22a66f1",
        message: "Initialize robot control project",
        author: "Michael Mazilu",
        timestamp: "2026-06-11T19:18:00-04:00",
        relativeTime: "2 weeks ago",
      },
    ],
  },
];

export function getRepository(name: string): Repository | undefined {
  return repositories.find((repo) => repo.name === name);
}

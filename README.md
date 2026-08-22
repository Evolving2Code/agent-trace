# agent-trace

**Browser DevTools for AI agents** — record, replay, and fork agent runs locally.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

<p align="center">
  <strong>🎬 Scrub through agent runs like a video · 🔀 Fork at any step · 📊 Watch cost burn in real-time</strong>
</p>

---

## Why agent-trace?

AI agents are black boxes. When they loop, hallucinate, or burn through your API budget, you're stuck reading raw JSON logs.

**agent-trace** is a local-first replay studio for coding agents. It records every thought, tool call, and LLM request as an event stream — then lets you scrub through runs, fork from any checkpoint, and diff golden vs. failed behavior.

No cloud account. No signup. One SQLite file.

## Quick Start

```bash
# Clone and install
git clone https://github.com/Evolving2Code/agent-trace.git
cd agent-trace
pnpm install
pnpm build

# Seed demo traces and open the replay studio
pnpm demo
pnpm play
```

The replay studio opens at `http://localhost:4173`. It works on desktop and mobile — on smaller screens, use the bottom tabs to switch between Timeline, Inspector, and Flow.

### First-time install note

`pnpm install` may ask you to approve native build scripts for `better-sqlite3` (the local SQLite driver). If prompted:

```bash
pnpm approve-builds   # select better-sqlite3
pnpm install
```

This is a one-time setup step per machine.

## Import Cursor Transcripts

Import agent runs from Cursor Cloud Agents or local Cursor IDE sessions:

```bash
# List transcripts discovered on this machine
node packages/cli/dist/index.js cursor list

# Import the most recent discovered transcript
node packages/cli/dist/index.js import-cursor --latest

# Import a specific transcript file or directory
node packages/cli/dist/index.js import-cursor ~/.cursor/projects/<workspace>/agent-transcripts/<session>.jsonl
node packages/cli/dist/index.js import-cursor /tmp/cursor/cloud-agent-transcripts/<batch>/<bcId>/transcript.json

# Import and immediately open the replay studio
node packages/cli/dist/index.js import-cursor --latest --play
```

### Supported formats

| Format | Location | Notes |
|---|---|---|
| **Cloud JSON** | `/tmp/cursor/cloud-agent-transcripts/**/transcript.json` | Full tool I/O + timing (Cloud Agents) |
| **Local JSONL** | `~/.cursor/projects/*/agent-transcripts/*.jsonl` | Desktop IDE sessions |

The importer maps Cursor messages to agent-trace events: user prompts, agent thoughts, tool calls, file edits, shell commands, and completion status.

## Demo

```bash
# List available demo scenarios
node packages/cli/dist/index.js scenarios

# Seed a specific scenario
pnpm demo -- --scenario infinite-loop

# Replay a specific run
node packages/cli/dist/index.js play <run-id>
```

### Built-in scenarios

| Scenario | Description |
|---|---|
| `fix-auth-bug` | Agent debugs a JWT validation failure and patches middleware |
| `infinite-loop` | Agent gets stuck retrying a failing API until timeout |
| `refactor-api` | Successful multi-step refactor with tests |

## Features

### 🎬 Timeline Replay
Scrub through agent runs step-by-step with play/pause, speed control (0.5x–4x), and keyboard shortcuts on desktop.

### 📱 Responsive Replay Studio
- **Mobile:** bottom tab navigation (Timeline / Inspector / Flow)
- **Tablet:** event list + inspector side by side
- **Desktop:** full three-panel layout with agent flow graph

### 🔀 Fork at Any Step
Branch a run from any event. Inherited history is copied; new events append from the fork point.

```bash
node packages/cli/dist/index.js fork <run-id> <event-id> --name "retry with gpt-4"
```

### 📊 Live Cost & Token Tracking
Watch cumulative token usage and cost update as you scrub through the timeline.

### 📁 Local-First
Everything lives in `~/.agent-trace/traces.db`. No telemetry, no cloud dependency.

### 📤 Export & Share
```bash
node packages/cli/dist/index.js export <run-id> -o my-run.trace.json
node packages/cli/dist/index.js import my-run.trace.json
```

## CLI Reference

```
agent-trace init              Initialize local database
agent-trace demo              Seed demo traces
agent-trace list              List recorded runs
agent-trace play [run-id]     Open replay studio
agent-trace export <run-id>   Export run as JSON
agent-trace import <file>     Import run from JSON
agent-trace import-cursor [path] Import Cursor transcript (--latest, --all, --play)
agent-trace cursor list       List discovered Cursor transcripts
agent-trace fork <run> <evt>  Fork run from event
agent-trace scenarios         List demo scenarios
```

## Architecture

```
agent-trace/
├── packages/
│   ├── core/       Event-sourced trace store (SQLite) + replay engine
│   ├── cli/        Command-line interface
│   └── viewer/     Replay studio UI (React + Vite)
└── examples/       Sample trace exports
```

### Event Model

Every agent run is an append-only event stream:

```
run.started → user.message → agent.thought → tool.call → tool.result → llm.request → llm.response → file.edit → run.completed
```

Events are stored in SQLite with full metadata: tokens, cost, latency, status, and arbitrary JSON payloads.

### Replay Modes (roadmap)

| Mode | Status | Description |
|---|---|---|
| **Simulated** | ✅ v0.1 | Replay from cache — instant, no API calls |
| **Deterministic fork** | ✅ v0.1 | Branch from checkpoint with inherited history |
| **Live shadow** | 🔜 v0.2 | Re-run with different model in parallel |

## Integrations

- [x] Cursor agent transcript import (cloud JSON + local JSONL)
- [ ] Claude Code / Codex hook capture
- [ ] OpenTelemetry ingest
- [ ] Langfuse trace import
- [ ] MCP tool call visualization

## Development

```bash
pnpm install
pnpm build          # Build all packages
pnpm dev            # Start viewer dev server
pnpm demo           # Seed demo data
pnpm play           # Open replay studio
pnpm typecheck      # Type-check all packages
```

## Troubleshooting

| Issue | Fix |
|---|---|
| `pnpm install` fails on `better-sqlite3` | Run `pnpm approve-builds`, select `better-sqlite3`, then `pnpm install` again |
| `pnpm play` says no traces | Run `pnpm demo` first |
| Port 4173 already in use | `node packages/cli/dist/index.js play --port 4174` |
| Viewer shows blank page | Run `pnpm build` to compile the viewer bundle |

## Comparison

| Feature | agent-trace | Langfuse | AgentOps | LangSmith |
|---|---|---|---|---|
| Open source | ✅ MIT | ✅ (partial) | ❌ | ❌ |
| Local-first / offline | ✅ | Self-host | ❌ | ❌ |
| Timeline replay | ✅ | ❌ | ✅ | ❌ |
| Fork at checkpoint | ✅ | ❌ | Partial | ❌ |
| Zero-config SQLite | ✅ | ❌ | ❌ | ❌ |
| Coding-agent focus | ✅ | Partial | ❌ | Partial |
| Mobile-friendly replay UI | ✅ | Partial | ❌ | ❌ |

## License

MIT © [Victor](https://github.com/Evolving2Code)

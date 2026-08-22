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

That's it. The replay studio opens in your browser.

## Demo

```bash
# List available demo scenarios
npx agent-trace scenarios

# Seed a specific scenario
npx agent-trace demo --scenario infinite-loop

# Replay a specific run
npx agent-trace play <run-id>
```

### Built-in scenarios

| Scenario | Description |
|---|---|
| `fix-auth-bug` | Agent debugs a JWT validation failure and patches middleware |
| `infinite-loop` | Agent gets stuck retrying a failing API until timeout |
| `refactor-api` | Successful multi-step refactor with tests |

## Features

### 🎬 Timeline Replay
Scrub through agent runs step-by-step with play/pause, speed control (0.5x–4x), and keyboard shortcuts.

### 🔀 Fork at Any Step
Branch a run from any event. Inherited history is copied; new events append from the fork point.

```bash
agent-trace fork <run-id> <event-id> --name "retry with gpt-4"
```

### 📊 Live Cost & Token Tracking
Watch cumulative token usage and cost update as you scrub through the timeline.

### 📁 Local-First
Everything lives in `~/.agent-trace/traces.db`. No telemetry, no cloud dependency.

### 📤 Export & Share
```bash
agent-trace export <run-id> -o my-run.trace.json
agent-trace import my-run.trace.json
```

## CLI Reference

```
agent-trace init              Initialize local database
agent-trace demo              Seed demo traces
agent-trace list              List recorded runs
agent-trace play [run-id]     Open replay studio
agent-trace export <run-id>   Export run as JSON
agent-trace import <file>     Import run from JSON
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

## Integrations (roadmap)

- [ ] Cursor agent transcript import
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
```

## Comparison

| Feature | agent-trace | Langfuse | AgentOps | LangSmith |
|---|---|---|---|---|
| Open source | ✅ MIT | ✅ (partial) | ❌ | ❌ |
| Local-first / offline | ✅ | Self-host | ❌ | ❌ |
| Timeline replay | ✅ | ❌ | ✅ | ❌ |
| Fork at checkpoint | ✅ | ❌ | Partial | ❌ |
| Zero-config SQLite | ✅ | ❌ | ❌ | ❌ |
| Coding-agent focus | ✅ | Partial | ❌ | Partial |

## Star History

If agent-trace helps you debug agents, consider starring the repo — it helps others discover the project.

## License

MIT © [Victor](https://github.com/Evolving2Code)

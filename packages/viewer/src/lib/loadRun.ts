import type { Run, TraceEvent } from "@agent-trace/core/browser";

export interface RunData {
  run: Run;
  events: TraceEvent[];
}

export async function loadRunData(): Promise<RunData> {
  try {
    const res = await fetch("/api/run");
    if (res.ok) return (await res.json()) as RunData;
  } catch {
    // fall through to embedded demo
  }

  const envFile = import.meta.env.VITE_RUN_FILE;
  if (envFile) {
    const res = await fetch(envFile);
    if (res.ok) return (await res.json()) as RunData;
  }

  return getEmbeddedDemo();
}

function getEmbeddedDemo(): RunData {
  const t0 = Date.now() - 45_000;
  const run: Run = {
    id: "demo-fix-auth",
    name: "Fix Auth Bug",
    status: "completed",
    source: "cursor",
    model: "claude-sonnet-4",
    startedAt: t0,
    completedAt: t0 + 42_000,
    totalTokensIn: 4200,
    totalTokensOut: 180,
    totalCostUsd: 0.018,
    totalLatencyMs: 8900,
    metadata: { scenario: "fix-auth-bug" },
  };

  const events: TraceEvent[] = [
    { id: "e0", runId: run.id, sequence: 0, timestamp: t0, type: "run.started", data: { prompt: "Fix the 401 errors on /api/users endpoint" } },
    { id: "e1", runId: run.id, sequence: 1, timestamp: t0 + 500, type: "user.message", label: "User request", data: { content: "Users are getting 401 on /api/users after login. Fix it." } },
    { id: "e2", runId: run.id, sequence: 2, timestamp: t0 + 1200, type: "agent.thought", data: { content: "I need to investigate the auth middleware and JWT validation logic." } },
    { id: "e3", runId: run.id, sequence: 3, timestamp: t0 + 2400, type: "tool.call", data: { tool: "Read", path: "src/middleware/auth.ts" }, latencyMs: 45 },
    { id: "e4", runId: run.id, sequence: 4, timestamp: t0 + 2500, type: "tool.result", data: { tool: "Read", content: "export function validateJWT(token) { return jwt.verify(token, process.env.JWT_SECRET); }" }, status: "ok" },
    { id: "e5", runId: run.id, sequence: 5, timestamp: t0 + 4000, type: "agent.thought", data: { content: "JWT_SECRET might be undefined in production. Checking env config." } },
    { id: "e6", runId: run.id, sequence: 6, timestamp: t0 + 5200, type: "llm.request", data: { model: "claude-sonnet-4", messages: 3 }, tokensIn: 4200, costUsd: 0.0126, latencyMs: 890 },
    { id: "e7", runId: run.id, sequence: 7, timestamp: t0 + 6100, type: "llm.response", data: { content: "Found the issue: JWT_SECRET is not passed in Docker compose." }, tokensOut: 180, costUsd: 0.0054 },
    { id: "e8", runId: run.id, sequence: 8, timestamp: t0 + 8000, type: "file.edit", data: { path: "docker-compose.yml", diff: "+      - JWT_SECRET\n", description: "Add JWT_SECRET to api service" } },
    { id: "e9", runId: run.id, sequence: 9, timestamp: t0 + 9500, type: "file.edit", data: { path: "src/middleware/auth.ts", diff: "+  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');\n" } },
    { id: "e10", runId: run.id, sequence: 10, timestamp: t0 + 12000, type: "shell.command", data: { command: "npm test -- --grep auth" }, latencyMs: 3200 },
    { id: "e11", runId: run.id, sequence: 11, timestamp: t0 + 15200, type: "tool.result", data: { tool: "Shell", exitCode: 0, stdout: "✓ 12 tests passed" }, status: "ok" },
    { id: "e12", runId: run.id, sequence: 12, timestamp: t0 + 16500, type: "run.completed", data: { summary: "Fixed missing JWT_SECRET in Docker compose." } },
  ];

  return { run, events };
}

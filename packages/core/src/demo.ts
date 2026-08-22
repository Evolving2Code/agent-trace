import type { TraceEvent } from "./types.js";
import { TraceStore } from "./store.js";

export interface DemoScenario {
  name: string;
  description: string;
  source: string;
  model: string;
}

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  "fix-auth-bug": {
    name: "Fix Auth Bug",
    description: "Agent debugs a JWT validation failure and patches the middleware",
    source: "cursor",
    model: "claude-sonnet-4",
  },
  "infinite-loop": {
    name: "Infinite Loop",
    description: "Agent gets stuck retrying a failing API call until timeout",
    source: "claude-code",
    model: "claude-opus-4",
  },
  "refactor-api": {
    name: "Refactor API",
    description: "Successful multi-step refactor with tests and deployment",
    source: "cursor",
    model: "gpt-4.1",
  },
};

function delay(base: number, step: number): number {
  return base + step * 1200;
}

export function seedDemoRun(store: TraceStore, scenarioId: string): string {
  const scenario = DEMO_SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

  switch (scenarioId) {
    case "fix-auth-bug":
      return seedFixAuthBug(store, scenario);
    case "infinite-loop":
      return seedInfiniteLoop(store, scenario);
    case "refactor-api":
      return seedRefactorApi(store, scenario);
    default:
      throw new Error(`No seeder for: ${scenarioId}`);
  }
}

function seedFixAuthBug(store: TraceStore, scenario: DemoScenario): string {
  const run = store.createRun({
    name: scenario.name,
    source: scenario.source,
    model: scenario.model,
    metadata: { scenario: "fix-auth-bug", repo: "acme-api" },
  });
  const t0 = Date.now() - 45_000;
  let step = 0;

  const add = (type: TraceEvent["type"], data: Record<string, unknown>, extras: Partial<TraceEvent> = {}) => {
    store.appendEvent(run.id, {
      timestamp: delay(t0, step++),
      type,
      data,
      ...extras,
    });
  };

  add("run.started", { prompt: "Fix the 401 errors on /api/users endpoint" });
  add("user.message", { content: "Users are getting 401 on /api/users after login. Fix it." }, { label: "User request" });
  add("agent.thought", {
    content: "I need to investigate the auth middleware and JWT validation logic. Let me start by reading the relevant files.",
  });
  add("tool.call", { tool: "Read", path: "src/middleware/auth.ts" }, { latencyMs: 45 });
  add("tool.result", { tool: "Read", content: "export function validateJWT(token) { return jwt.verify(token, process.env.JWT_SECRET); }" }, { status: "ok" });
  add("agent.thought", { content: "The JWT secret might be undefined in production. Let me check the env config." });
  add("tool.call", { tool: "Grep", pattern: "JWT_SECRET", path: "." }, { latencyMs: 120 });
  add("tool.result", { tool: "Grep", matches: ["src/config.ts:12", ".env.example:8"] }, { status: "ok" });
  add("llm.request", { model: scenario.model, messages: 3 }, { tokensIn: 4200, costUsd: 0.0126, latencyMs: 890 });
  add("llm.response", { content: "Found the issue: JWT_SECRET is read from process.env but the Docker compose file doesn't pass it through." }, { tokensOut: 180, costUsd: 0.0054 });
  add("tool.call", { tool: "Read", path: "docker-compose.yml" }, { latencyMs: 38 });
  add("tool.result", { tool: "Read", content: "services:\n  api:\n    environment:\n      - DATABASE_URL\n      # JWT_SECRET missing!" }, { status: "ok" });
  add("file.edit", {
    path: "docker-compose.yml",
    diff: "+      - JWT_SECRET\n",
    description: "Add JWT_SECRET to api service environment",
  });
  add("file.edit", {
    path: "src/middleware/auth.ts",
    diff: "+  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');\n",
    description: "Add guard for missing JWT_SECRET",
  });
  add("shell.command", { command: "npm test -- --grep auth", cwd: "acme-api" }, { latencyMs: 3200 });
  add("tool.result", { tool: "Shell", exitCode: 0, stdout: "✓ 12 tests passed" }, { status: "ok" });
  add("agent.thought", { content: "Tests pass. The fix adds JWT_SECRET to Docker env and adds a startup guard." });
  add("run.completed", { summary: "Fixed missing JWT_SECRET in Docker compose. Added validation guard." });

  store.completeRun(run.id, "completed");
  return run.id;
}

function seedInfiniteLoop(store: TraceStore, scenario: DemoScenario): string {
  const run = store.createRun({
    name: scenario.name,
    source: scenario.source,
    model: scenario.model,
    metadata: { scenario: "infinite-loop", repo: "data-pipeline" },
  });
  const t0 = Date.now() - 120_000;
  let step = 0;

  const add = (type: TraceEvent["type"], data: Record<string, unknown>, extras: Partial<TraceEvent> = {}) => {
    store.appendEvent(run.id, {
      timestamp: delay(t0, step++),
      type,
      data,
      ...extras,
    });
  };

  add("run.started", { prompt: "Fetch user analytics from the metrics API" });
  add("user.message", { content: "Pull last 30 days of user analytics and save to analytics.json" });
  add("agent.thought", { content: "I'll call the internal metrics API endpoint." });

  for (let i = 0; i < 5; i++) {
    add("tool.call", { tool: "Shell", command: `curl -s http://metrics.internal/api/v1/analytics?days=30` }, { latencyMs: 5000, status: "error" });
    add("error", { message: "Connection refused: metrics.internal:80", attempt: i + 1 }, { status: "error" });
    add("agent.thought", { content: `Attempt ${i + 1} failed. Retrying with exponential backoff...` });
    add("llm.request", { model: scenario.model }, { tokensIn: 2800 + i * 400, costUsd: 0.008 + i * 0.002, latencyMs: 650 });
    add("llm.response", { content: "Let me try again with a different approach." }, { tokensOut: 95, costUsd: 0.003 });
  }

  add("error", { message: "Max retries exceeded. Agent loop detected.", totalAttempts: 5 }, { status: "error" });
  add("run.failed", { reason: "Infinite retry loop on unreachable endpoint", totalCost: "$0.14" });
  store.completeRun(run.id, "failed");
  return run.id;
}

function seedRefactorApi(store: TraceStore, scenario: DemoScenario): string {
  const run = store.createRun({
    name: scenario.name,
    source: scenario.source,
    model: scenario.model,
    metadata: { scenario: "refactor-api", repo: "shop-api" },
  });
  const t0 = Date.now() - 90_000;
  let step = 0;

  const add = (type: TraceEvent["type"], data: Record<string, unknown>, extras: Partial<TraceEvent> = {}) => {
    store.appendEvent(run.id, {
      timestamp: delay(t0, step++),
      type,
      data,
      ...extras,
    });
  };

  add("run.started", { prompt: "Refactor the orders API to use repository pattern" });
  add("user.message", { content: "Refactor src/routes/orders.ts to use a repository pattern with proper tests" });
  add("agent.thought", { content: "I'll create an OrderRepository, update the route handlers, and add unit tests." });
  add("tool.call", { tool: "Glob", pattern: "src/**/*.ts" }, { latencyMs: 85 });
  add("tool.result", { tool: "Glob", files: ["src/routes/orders.ts", "src/models/order.ts", "src/db.ts"] });
  add("file.edit", { path: "src/repositories/orderRepository.ts", description: "Create OrderRepository class", diff: "+export class OrderRepository { ... }" });
  add("file.edit", { path: "src/routes/orders.ts", description: "Refactor route to use repository", diff: "-const db = getDb();\n+const repo = new OrderRepository();" });
  add("file.edit", { path: "src/repositories/orderRepository.test.ts", description: "Add unit tests", diff: "+describe('OrderRepository', () => { ... });" });
  add("shell.command", { command: "npm test", cwd: "shop-api" }, { latencyMs: 4500 });
  add("tool.result", { tool: "Shell", exitCode: 0, stdout: "✓ 28 tests passed" }, { status: "ok" });
  add("llm.request", { model: scenario.model }, { tokensIn: 8500, costUsd: 0.0255, latencyMs: 1200 });
  add("llm.response", { content: "Refactor complete. All tests passing." }, { tokensOut: 220, costUsd: 0.0066 });
  add("run.completed", { summary: "Refactored orders API to repository pattern with 8 new tests" });
  store.completeRun(run.id, "completed");
  return run.id;
}

export function seedAllDemos(store: TraceStore): string[] {
  return Object.keys(DEMO_SCENARIOS).map((id) => seedDemoRun(store, id));
}

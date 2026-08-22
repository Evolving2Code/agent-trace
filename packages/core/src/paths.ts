import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_DB_PATH = join(homedir(), ".agent-trace", "traces.db");

export function resolveDbPath(explicit?: string): string {
  return explicit ?? process.env.AGENT_TRACE_DB ?? DEFAULT_DB_PATH;
}

import type { Plugin } from "vite";
import { readFileSync, existsSync } from "node:fs";

export function runDataPlugin(): Plugin {
  return {
    name: "agent-trace-run-data",
    configureServer(server) {
      server.middlewares.use("/api/run", (_req, res) => {
        const runFile = process.env.AGENT_TRACE_RUN_FILE;
        if (runFile && existsSync(runFile)) {
          res.setHeader("Content-Type", "application/json");
          res.end(readFileSync(runFile, "utf-8"));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "No run file configured" }));
        }
      });
    },
  };
}

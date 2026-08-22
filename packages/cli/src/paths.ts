import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveViewerDist(moduleUrl: string): string {
  const moduleDir = dirname(fileURLToPath(moduleUrl));
  const candidates = [
    join(moduleDir, "../viewer-dist"),
    join(moduleDir, "../../viewer/dist"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

export function resolveViewerSource(moduleUrl: string): string | null {
  const moduleDir = dirname(fileURLToPath(moduleUrl));
  const sourceDir = join(moduleDir, "../../viewer");
  return existsSync(sourceDir) ? sourceDir : null;
}

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverCursorTranscripts,
  parseCursorCloudTranscript,
  parseCursorLocalTranscript,
  parseCursorTranscriptFile,
} from "./index.js";
import { TraceStore } from "../store.js";
import { importCursorTranscript } from "./import.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, "../../fixtures");
const cloudFixture = readFileSync(join(fixtureDir, "cloud-transcript.json"), "utf-8");
const localFixture = readFileSync(join(fixtureDir, "local-transcript.jsonl"), "utf-8");

test("parseCursorCloudTranscript maps user, thought, tools, and completion", () => {
  const parsed = parseCursorCloudTranscript(cloudFixture, { name: "Auth fix" });
  assert.equal(parsed.run.name, "Auth fix");
  assert.equal(parsed.run.source, "cursor");
  assert.equal(parsed.run.status, "completed");

  const types = parsed.events.map((e) => e.type);
  assert.ok(types.includes("run.started"));
  assert.ok(types.includes("user.message"));
  assert.ok(types.includes("agent.thought"));
  assert.ok(types.includes("file.edit"));
  assert.ok(types.includes("run.completed"));

  const readResult = parsed.events.find((e) => e.data.tool === "read_file" && e.type === "tool.result");
  assert.ok(readResult?.data.content);
});

test("parseCursorLocalTranscript maps jsonl content blocks", () => {
  const parsed = parseCursorLocalTranscript(localFixture);
  assert.equal(parsed.run.source, "cursor");
  assert.ok(parsed.events.some((e) => e.type === "user.message"));
  assert.ok(parsed.events.some((e) => e.type === "agent.thought"));
  assert.ok(parsed.events.some((e) => e.type === "file.edit"));
});

test("parseCursorTranscriptFile auto-detects format from extension", () => {
  const cloud = parseCursorTranscriptFile(cloudFixture, "transcript.json");
  const local = parseCursorTranscriptFile(localFixture, "session.jsonl");
  assert.equal(cloud.run.metadata?.cursorFormat, "cloud-json");
  assert.equal(local.run.metadata?.cursorFormat, "local-jsonl");
});

test("importCursorTranscript stores events in sqlite", () => {
  const dbPath = "/tmp/agent-trace-cursor-import-test.db";
  const store = new TraceStore(dbPath);
  try {
    const run = importCursorTranscript(
      store,
      join(fixtureDir, "cloud-transcript.json"),
      { name: "Imported auth fix" }
    );
    const events = store.getEvents(run.id);
    assert.ok(events.length >= 5);
    assert.equal(run.source, "cursor");
    assert.equal(run.name, "Imported auth fix");
  } finally {
    store.close();
  }
});

test("discoverCursorTranscripts finds cloud transcripts in /tmp", () => {
  const transcripts = discoverCursorTranscripts(["/tmp/cursor/cloud-agent-transcripts"]);
  assert.ok(transcripts.length >= 1);
  assert.equal(transcripts[0].format, "cloud-json");
});

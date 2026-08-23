#!/usr/bin/env node
/**
 * Records an automated replay-studio walkthrough for the README hero demo.
 *
 * Prerequisites:
 *   1. pnpm build
 *   2. node packages/cli/dist/index.js demo --scenario fix-auth-bug
 *   3. node packages/cli/dist/index.js play <run-id> --no-open
 *   4. npm i -D playwright && npx playwright install chromium
 *   5. ffmpeg
 *
 * Usage (from repo root):
 *   pnpm record:hero
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const PORT = process.env.PORT ?? "4173";
const URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = join(process.cwd(), "docs", "assets");
const TMP_DIR = join(OUT_DIR, ".record-tmp");

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 820 },
    deviceScaleFactor: 2,
    recordVideo: { dir: TMP_DIR, size: { width: 1400, height: 820 } },
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByText("Fix Auth Bug", { exact: false }).first().waitFor({ timeout: 15_000 });
  await wait(800);

  // Play through the run at 2x
  await page.getByRole("button", { name: "2x" }).click();
  await page.getByRole("button", { name: "Play replay" }).click();
  await wait(4500);
  await page.getByRole("button", { name: "Pause replay" }).click();
  await wait(500);

  // Scrub to a file edit on the timeline
  await page.getByRole("button", { name: /Go to step 12: file\.edit/ }).click();
  await wait(1200);

  // Jump to shell command
  await page.getByRole("button", { name: /Go to step 14: shell\.command/ }).click();
  await wait(1200);

  // Step back through events in the sidebar
  await page.getByRole("button", { name: "Step back" }).click();
  await wait(700);
  await page.getByRole("button", { name: "Step back" }).click();
  await wait(700);

  // Replay from the start briefly
  await page.getByRole("button", { name: /Go to step 0: run\.started/ }).click();
  await wait(600);
  await page.getByRole("button", { name: "Play replay" }).click();
  await wait(2200);
  await page.getByRole("button", { name: "Pause replay" }).click();
  await wait(600);

  const video = page.video();
  await context.close();
  await browser.close();

  const videoPath = await video.path();
  const mp4Path = join(OUT_DIR, "replay-studio.mp4");
  const gifPath = join(OUT_DIR, "replay-studio.gif");

  await run("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    "fps=12,scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
    "-loop",
    "0",
    gifPath,
  ]);

  await run("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    "scale=1200:-2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4Path,
  ]);

  await rm(TMP_DIR, { recursive: true, force: true });
  console.log(`Wrote ${gifPath}`);
  console.log(`Wrote ${mp4Path}`);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

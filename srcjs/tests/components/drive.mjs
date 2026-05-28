#!/usr/bin/env node
/**
 * Component harness driver — loads the harness in headless Chromium,
 * navigates to a scenario, optionally runs a script of clicks, then
 * dumps state + log. Designed for puppeteer-mediated agent flows AND
 * for screenshot regression of components in isolation.
 *
 * Usage:
 *   node tests/components/drive.mjs <scenario>
 *   node tests/components/drive.mjs <scenario> --screenshot path.png
 *   node tests/components/drive.mjs <scenario> --interact 'role=switch'
 *
 * Output: JSON to stdout `{state, log}` after the run. Non-zero
 * exit when the harness fails to mount or the scenario isn't found.
 *
 * Prerequisite: `bun run build:harness` (or `vite build -c
 * vite.config.harness.ts`) must have written
 * `tests/components/dist/harness.html`. The driver reads from that
 * file via `file://` — no dev server needed.
 */

import puppeteer from "puppeteer";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

// Modern Chrome blocks ESM imports over file:// (CORS). Boot a
// throw-away HTTP server that serves the dist/ directory; puppeteer
// connects via http://127.0.0.1:<port>/. The server is closed in the
// finally block.
function serveDir(dir) {
  return new Promise((resolve) => {
    const TYPES = {
      ".html": "text/html; charset=utf-8",
      ".js":   "application/javascript; charset=utf-8",
      ".css":  "text/css; charset=utf-8",
      ".map":  "application/json",
      ".png":  "image/png",
      ".svg":  "image/svg+xml",
      ".json": "application/json",
    };
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url ?? "/").split("?")[0].split("#")[0]);
      if (urlPath === "/") urlPath = "/harness.html";
      const filePath = path.join(dir, urlPath);
      if (!filePath.startsWith(dir)) { res.statusCode = 403; res.end(); return; }
      if (!existsSync(filePath)) { res.statusCode = 404; res.end(`not found: ${urlPath}`); return; }
      const ct = TYPES[path.extname(filePath)] ?? "application/octet-stream";
      res.setHeader("Content-Type", ct);
      res.end(readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const argv = process.argv.slice(2);
const scenario = argv[0];
if (!scenario || scenario.startsWith("--")) {
  process.stderr.write("usage: drive.mjs <scenario> [--screenshot path] [--fullpage] [--interact selector] [--headed]\n");
  process.exit(2);
}

function flag(name)      { return argv.includes(`--${name}`); }
function opt(name, dflt) { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt; }

const HERE         = path.dirname(new URL(import.meta.url).pathname);
const DIST         = path.join(HERE, "dist");
const HARNESS_HTML = path.join(DIST, "harness.html");
const screenshot   = opt("screenshot");
const interactSel  = opt("interact");
const headed       = flag("headed");
const fullPage     = flag("fullpage");
const viewport     = opt("viewport", "1400x900"); // WxH

if (!existsSync(HARNESS_HTML)) {
  process.stderr.write(`drive: harness build not found at ${HARNESS_HTML}\n`);
  process.stderr.write(`Build first:  cd srcjs && npm run build:harness\n`);
  process.exit(2);
}

const { server, url: serverUrl } = await serveDir(DIST);
const browser = await puppeteer.launch({
  headless: !headed,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  const [vw, vh] = viewport.split("x").map((n) => parseInt(n, 10));
  if (!Number.isFinite(vw) || !Number.isFinite(vh)) {
    process.stderr.write(`drive: invalid --viewport "${viewport}" — expected WxH (e.g. 1400x900)\n`);
    process.exit(2);
  }
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 2 });
  await page.goto(`${serverUrl}/harness.html#${scenario}`, { waitUntil: "networkidle0", timeout: 15000 });

  // The harness initializes its global on mount; wait for it.
  await page.waitForFunction(() => !!window.__harness, { timeout: 5000 });

  // If the requested scenario didn't resolve (likely a typo), the
  // harness falls back to the first scenario. Surface that to the caller.
  const activeName = await page.evaluate(() => window.location.hash.replace(/^#/, ""));
  if (activeName !== scenario) {
    process.stderr.write(`drive: requested "${scenario}", harness routed to "${activeName}"\n`);
  }

  if (interactSel) {
    // Single click for now. Future: pass a script of multi-step actions
    // (click, type, drag) via JSON on stdin.
    await page.click(interactSel);
    // Let any $effect chains settle before reading state.
    await new Promise((r) => setTimeout(r, 100));
  }

  const result = await page.evaluate(() => ({
    state: window.__harness.getState(),
    log:   window.__harness.getLog(),
  }));

  if (screenshot) {
    const dir = path.dirname(screenshot);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Full-page screenshot — the harness stage scrolls; we want the
    // whole content surface for visual review, not just the fold.
    await page.screenshot({ path: screenshot, type: "png", fullPage: fullPage });
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} finally {
  await browser.close();
  server.close();
}

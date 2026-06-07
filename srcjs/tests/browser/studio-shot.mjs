#!/usr/bin/env node
/**
 * Studio screenshot harness (theme-rework Wave 1).
 *
 * The studio is a Shiny gadget — there was no way to eyeball it without
 * launching R. It also boots in standalone "forge mode" (no host data:
 * synthesizes a sample spec + cochrane theme), so it screenshots cleanly
 * out of a static page. This harness serves inst/studio/ over HTTP (the
 * file:// CORS rule from CLAUDE.md) and snapshots the mounted shell.
 *
 * Usage:
 *   node tests/browser/studio-shot.mjs [out.png]
 * Default output: tests/browser/screenshots/studio.png
 *
 * Exits non-zero if the role spine never mounts (the Wave-1 deliverable)
 * — so it doubles as a smoke gate, not just an eyeball aid.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_DIR = path.resolve(__dirname, "../../../inst/studio");
const OUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "screenshots", "studio.png");

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/studio.css">
<style>html,body{margin:0;height:100%}#tabviz-studio-mount{height:100vh}</style>
</head><body>
<div id="tabviz-studio-mount"></div>
<script src="/studio.js"></script>
</body></html>`;

const MIME = { ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".json": "application/json" };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url.split("?")[0];
      if (url === "/" || url === "/index.html") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(PAGE);
        return;
      }
      const file = path.join(STUDIO_DIR, path.normalize(url));
      if (!file.startsWith(STUDIO_DIR) || !fs.existsSync(file)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  if (!fs.existsSync(path.join(STUDIO_DIR, "studio.js"))) {
    console.error(`studio bundle not found at ${STUDIO_DIR} — run: npm run build:studio`);
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const server = await serve();
  const { port } = server.address();
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000, // the deviceScaleFactor screenshot can be slow in CI
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  let failed = false;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 30000 });
    // The Wave-1 deliverable + the actual GATE: the role spine mounts in the
    // left rail with >0 roles and the page throws nothing. These set `failed`.
    await page.waitForSelector(".role-spine", { timeout: 15000 });
    await page.waitForSelector(".studio-chart", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));
    const roleCount = await page.$$eval(".role-spine .role-token", (n) => n.length);
    console.log(`✓ role spine mounted with ${roleCount} role tokens`);
    if (roleCount === 0) { failed = true; console.error("✗ spine mounted but rendered 0 roles"); }
    if (errors.length) { failed = true; console.error("✗ page errors:\n  " + errors.join("\n  ")); }
    // The screenshot is the eyeball AID, not the gate — a capture timeout
    // (puppeteer protocol flake) must not fail the smoke when the assertions
    // above already passed.
    try {
      await page.screenshot({ path: OUT, type: "png", fullPage: false });
      console.log(`screenshot → ${OUT}`);
    } catch (shotErr) {
      console.warn(`(screenshot skipped: ${shotErr.message})`);
    }
  } catch (err) {
    failed = true;
    console.error("studio-shot failed:", err.message);
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}

main();

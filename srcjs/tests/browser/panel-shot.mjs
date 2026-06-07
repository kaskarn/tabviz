#!/usr/bin/env node
// Screenshot the widget settings panel over HTTP — the viewer-side companion
// to studio-shot.mjs (theme-rework Wave 2). Opens the cog on the docs hero
// widget; `--advanced` also expands the lean-core "Advanced controls" toggle.
// Requires a rendered docs site (cd docs && quarto render index.qmd) carrying
// the CURRENT bundle. Usage: node tests/browser/panel-shot.mjs [out.png] [--advanced]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve("../docs/_site");
const OUT = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "/tmp/panel.png";
const ADVANCED = process.argv.includes("--advanced");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/") url = "/index.html";
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end("nf"); return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();

const browser = await puppeteer.launch({ headless: true, protocolTimeout: 120000, args: ["--no-sandbox"] });
const page = await browser.newPage();
// deviceScaleFactor 1 + a tall viewport: the expanded panel is long, and a
// 1.5x full-element capture protocol-times-out (puppeteer flake).
await page.setViewport({ width: 1100, height: 1500, deviceScaleFactor: 1 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 45000 });
await page.waitForSelector(".settings-btn", { timeout: 20000 });
// $eval-click avoids page.click's bounding-box evaluate, which raced the
// panel's open transition.
await page.$eval(".settings-btn", (el) => el.click());
await page.waitForSelector(".settings-panel", { timeout: 10000 });
if (ADVANCED) {
  await page.waitForSelector(".advanced-toggle", { timeout: 5000 });
  await page.$eval(".advanced-toggle", (el) => el.click());
}
await new Promise((r) => setTimeout(r, 600));
const panel = await page.$(".settings-panel");
await panel.screenshot({ path: OUT });
console.log(`screenshot → ${OUT}${errs.length ? "\nERRORS:\n  " + errs.join("\n  ") : "  (no page errors)"}`);
await browser.close();
server.close();

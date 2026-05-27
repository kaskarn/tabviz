#!/usr/bin/env node
/* drive-settings.mjs — open the settings panel and screenshot it.
 * Useful for verifying re-skin work on the *Field wrappers in tab
 * sub-controls.
 */
import puppeteer from "puppeteer";
import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { auditScript } from "./audit-layout.mjs";

const widget = process.argv[2];
const outPath = process.argv[3] ?? "/tmp/settings-panel.png";
const tab = process.argv[4] ?? "layout";
if (!widget) {
  process.stderr.write("usage: drive-settings.mjs <widget.html> [out.png] [tab]\n");
  process.exit(2);
}
const widgetPath = path.resolve(widget);
const dir = path.dirname(widgetPath);
const name = path.basename(widgetPath);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const fp = path.join(dir, u === "/" ? `/${name}` : u);
  if (!existsSync(fp)) { res.statusCode = 404; res.end(); return; }
  const ct = {".html":"text/html",".js":"application/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml",".json":"application/json"}[path.extname(fp)] ?? "application/octet-stream";
  res.setHeader("Content-Type", ct);
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".tabviz-container");
  await new Promise((r) => setTimeout(r, 300));
  // Click the settings gear button.
  const gear = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (b) => /Open display settings/i.test(b.getAttribute("aria-label") || ""),
    );
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!gear) throw new Error("settings button not found");
  await page.mouse.click(gear.x, gear.y);
  await new Promise((r) => setTimeout(r, 400));
  // Switch to the requested tab. The settings panel now uses a
  // TabSelect dropdown: click the trigger (haspopup=listbox), then
  // click the listbox option whose text starts with the wanted label.
  await page.evaluate(async (t) => {
    const want = t.toLowerCase();
    const trigger = document.querySelector('button[aria-haspopup="listbox"]');
    if (!trigger) return;
    trigger.click();
    await new Promise((r) => setTimeout(r, 80));
    const options = [...document.querySelectorAll('[role="option"]')];
    const opt = options.find((o) => (o.textContent ?? "").trim().toLowerCase().startsWith(want));
    opt?.click();
  }, tab);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: outPath, type: "png" });
  process.stdout.write(`screenshot: ${outPath}\n`);
  const audit = await page.evaluate(auditScript);
  const total = audit.offViewport.length + audit.clipped.length + audit.overlaps.length;
  if (total > 0) {
    process.stdout.write(`audit (${tab}): ` + JSON.stringify(audit) + "\n");
  } else {
    process.stdout.write(`audit (${tab}): clean\n`);
  }
} finally {
  await browser.close();
  server.close();
}

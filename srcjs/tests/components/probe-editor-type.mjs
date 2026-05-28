#!/usr/bin/env node
// Probe: open the column editor, focus the Header text field, type
// some characters, then read back the input's value to confirm
// keystrokes land.
import puppeteer from "puppeteer";
import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const widget = process.argv[2] ?? "/tmp/editor-text-probe.html";
const dir = path.dirname(widget);
const name = path.basename(widget);

const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const fp = path.join(dir, u === "/" ? `/${name}` : u);
  if (!existsSync(fp)) { res.statusCode = 404; res.end(); return; }
  const ct = {".html":"text/html",".js":"application/javascript",".css":"text/css"}[path.extname(fp)] ?? "application/octet-stream";
  res.setHeader("Content-Type", ct);
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1100, deviceScaleFactor: 1 });
  page.on("console", (msg) => process.stdout.write(`[console] ${msg.text()}\n`));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".tabviz-container", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));

  // Right-click a column header.
  const header = await page.evaluate(() => {
    const el = [...document.querySelectorAll("[data-header-id]")][1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!header) { console.error("no header"); process.exit(1); }
  await page.mouse.click(header.x, header.y, { button: "right" });
  await new Promise((r) => setTimeout(r, 250));

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button, [role='menuitem']")]
      .find(b => /configure/i.test(b.textContent || ""));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 250));

  // The column-type submenu may appear — pick the first leaf with text/numeric/interval/etc.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[role="menuitem"]')]
      .filter(b => b.offsetWidth > 0);
    // Take the first visible non-submenu leaf.
    btns[0]?.click();
  });
  await new Promise((r) => setTimeout(r, 350));

  // Take a screenshot before typing.
  await page.screenshot({ path: "/tmp/editor-before.png" });

  // Identify the truly-visible inputs (closed accordions clip via
  // `overflow: hidden` + grid 0fr so children still report offsetWidth
  // but have height 0). Filter by getBoundingClientRect bounds.
  const inputInfo = await page.evaluate(() => {
    const all = [...document.querySelectorAll("input[type='text'], input[type='number']")];
    return all.map((i, idx) => {
      const r = i.getBoundingClientRect();
      return {
        idx,
        cls: i.className,
        value: i.value,
        width: Math.round(r.width),
        height: Math.round(r.height),
        x: Math.round(r.x),
        y: Math.round(r.y),
      };
    }).filter((info) => info.height > 0 && info.width > 0);
  });
  console.log("truly visible inputs:", JSON.stringify(inputInfo, null, 2));

  if (inputInfo.length === 0) { console.error("no truly visible input"); process.exit(1); }

  // Pick the LAST one (most likely a free-form text input near the
  // bottom of an open accordion — e.g. Prefix, Suffix).
  const pick = inputInfo[inputInfo.length - 1];
  const inputRect = { x: pick.x + pick.width / 2, y: pick.y + pick.height / 2 };
  await page.mouse.click(inputRect.x, inputRect.y);
  await new Promise((r) => setTimeout(r, 100));

  // Check focus.
  const focused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    type: document.activeElement?.getAttribute("type"),
    cls: document.activeElement?.className,
  }));
  console.log("focused after click:", JSON.stringify(focused));

  // Type.
  await page.keyboard.type("HELLO");
  await new Promise((r) => setTimeout(r, 200));

  // Read input values.
  const after = await page.evaluate(() => {
    const all = [...document.querySelectorAll("input[type='text']")];
    return all.map((i) => ({ ph: i.placeholder, val: i.value, visible: i.offsetWidth > 0 }));
  });
  console.log("inputs after typing HELLO:", JSON.stringify(after, null, 2));

  await page.screenshot({ path: "/tmp/editor-after.png" });
} finally {
  await browser.close();
  server.close();
}

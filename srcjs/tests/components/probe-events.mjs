#!/usr/bin/env node
// Probe: right-click → Insert column after → pick Events leaf →
// screenshot the popover + dump any console errors.
import puppeteer from "puppeteer";
import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const widget = process.argv[2] ?? "/tmp/postinstall.html";
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
  await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });
  page.on("console", (msg) => process.stdout.write(`[${msg.type()}] ${msg.text()}\n`));
  page.on("pageerror", (err) => process.stdout.write(`[pageerror] ${err.message}\n`));
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

  // Click "Insert column after…"
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button, [role='menuitem']")]
      .find((x) => /insert column after/i.test(x.textContent || ""));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  await page.screenshot({ path: "/tmp/events-1-type-menu.png" });

  // Find the "Composite" submenu (which contains Events) and hover/click.
  // From ColumnTypeMenu.svelte:88: { kind:"submenu", key:"composite", label:"Composite"}.
  const composite = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[data-entry-key="composite"]')];
    if (!b.length) return null;
    const r = b[0].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!composite) { console.error("no composite submenu"); process.exit(1); }
  await page.mouse.move(composite.x, composite.y);
  await new Promise((r) => setTimeout(r, 250));
  await page.mouse.click(composite.x, composite.y);
  await new Promise((r) => setTimeout(r, 300));

  await page.screenshot({ path: "/tmp/events-2-submenu.png" });

  // Click Events leaf.
  const clicked = await page.evaluate(() => {
    // Submenu leaves don't have data-entry-key; match by label.
    const btns = [...document.querySelectorAll("button")]
      .filter((b) => /^Events/i.test((b.textContent || "").trim()));
    if (!btns.length) return false;
    btns[0].click();
    return true;
  });
  console.log("clicked Events leaf:", clicked);
  await new Promise((r) => setTimeout(r, 400));

  await page.screenshot({ path: "/tmp/events-3-editor.png" });

  // Dump visible buttons + inputs in the editor.
  const editorState = await page.evaluate(() => {
    const popover = [...document.querySelectorAll(".v2-popover-shell")].pop();
    if (!popover) return { error: "no popover" };
    return {
      hasPopover: true,
      visibleText: popover.innerText.slice(0, 800),
      inputCount: popover.querySelectorAll("input").length,
      slotPickers: [...popover.querySelectorAll("[aria-label]")].slice(0, 10).map((e) => e.getAttribute("aria-label")),
    };
  });
  console.log("editor state:", JSON.stringify(editorState, null, 2));
} finally {
  await browser.close();
  server.close();
}

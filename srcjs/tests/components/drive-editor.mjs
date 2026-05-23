#!/usr/bin/env node
/*
 * drive-editor.mjs — open a real htmlwidget, exercise the right-click
 * → Configure → popover chain, screenshot in normal and fullscreen
 * modes. The v2 schema-driven editor is the default since Step 8.
 *
 * Usage:
 *   node drive-editor.mjs <widget.html> [--column "HR (95% CI)"] \
 *                                       [--out-prefix /tmp/v2-popover] \
 *                                       [--fullscreen]
 *
 * The driver:
 *   1. Boots a local HTTP server rooted at the widget's parent dir
 *      (chrome won't load file:// htmlwidgets reliably).
 *   2. Navigates to the widget; waits for the table to render, then
 *      right-clicks a column header by text match.
 *   3. Clicks "Configure" in the resulting context menu.
 *   4. Screenshots the popover. If --fullscreen is set, clicks the
 *      fullscreen button first and re-runs the popover capture.
 */
import puppeteer from "puppeteer";
import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const widget = argv[0];
if (!widget || widget.startsWith("--")) {
  process.stderr.write("usage: drive-editor.mjs <widget.html> [--column TEXT] [--out-prefix PATH] [--fullscreen]\n");
  process.exit(2);
}
function flag(name) { return argv.includes(`--${name}`); }
function opt(name, dflt) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
}
const columnText = opt("column", "HR (95% CI)");
const outPrefix  = opt("out-prefix", "/tmp/v2-popover");
const fullscreen = flag("fullscreen");

const widgetPath = path.resolve(widget);
const widgetDir  = path.dirname(widgetPath);
const widgetName = path.basename(widgetPath);

if (!existsSync(widgetPath)) {
  process.stderr.write(`drive-editor: widget not found at ${widgetPath}\n`);
  process.exit(2);
}

const TYPES = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

function serveDir(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0].split("#")[0]);
      const filePath = path.join(dir, urlPath === "/" ? `/${widgetName}` : urlPath);
      if (!filePath.startsWith(dir)) { res.statusCode = 403; res.end(); return; }
      if (!existsSync(filePath)) { res.statusCode = 404; res.end(`not found: ${urlPath}`); return; }
      res.setHeader("Content-Type", TYPES[path.extname(filePath)] ?? "application/octet-stream");
      res.end(readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const { server, url } = await serveDir(widgetDir);
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });

  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector(".tabviz-container", { timeout: 10000 });
  // Let widget settle (debounced re-layouts).
  await new Promise((r) => setTimeout(r, 300));

  async function capture(suffix) {
    // Find the column header by text match.
    const header = await page.evaluate((text) => {
      const els = [...document.querySelectorAll("[data-header-id]")];
      const el = els.find((e) => (e.textContent || "").trim().includes(text));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, columnText);
    if (!header) throw new Error(`column header containing "${columnText}" not found`);

    // Right-click the header.
    await page.mouse.click(header.x, header.y, { button: "right" });
    await new Promise((r) => setTimeout(r, 150));

    // Click "Configure" in the context menu.
    const clicked = await page.evaluate(() => {
      const items = [...document.querySelectorAll("button, [role='menuitem']")];
      const c = items.find((b) => /configure/i.test(b.textContent || ""));
      if (!c) return false;
      (c).click();
      return true;
    });
    if (!clicked) throw new Error("Configure menu item not found");
    await new Promise((r) => setTimeout(r, 150));

    // The v2 type menu picker likely opens. Click any visible type entry
    // (or just the existing-type one) to advance into the popover.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => /interval/i.test(b.textContent || "") && b.offsetWidth > 0,
      );
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // Capture full viewport with the popover.
    await page.screenshot({ path: `${outPrefix}-${suffix}.png`, type: "png" });
    process.stdout.write(`screenshot: ${outPrefix}-${suffix}.png\n`);
  }

  await capture("normal");

  if (fullscreen) {
    // Close any open popover before toggling fullscreen.
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 100));
    // FullscreenButton's resolveContainer() reads document.activeElement,
    // so a programmatic .click() (which doesn't set focus) bails. Use a
    // real mouse click at the button's coords to set focus too.
    const fsBtn = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => /^Enter fullscreen$/.test(b.getAttribute("aria-label") || ""),
      );
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!fsBtn) {
      process.stderr.write("warning: fullscreen button not found, skipping fullscreen capture\n");
    } else {
      await page.mouse.click(fsBtn.x, fsBtn.y);
      await new Promise((r) => setTimeout(r, 500));
      await capture("fullscreen");
    }
  }
} finally {
  await browser.close();
  server.close();
}

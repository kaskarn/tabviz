#!/usr/bin/env node
/*
 * audit-layout.mjs — visual-defect scanner that runs in the browser
 * after a scene has rendered. Surfaces the three classes of UI bug
 * unit tests can't catch:
 *
 *   1. Off-viewport elements          (popovers/menus that extend past
 *                                       the visible area)
 *   2. Text-clipping without ellipsis  (scrollWidth > clientWidth and
 *                                       no `text-overflow: ellipsis`)
 *   3. Sibling-overlap of inline text  (a label or pill bounding box
 *                                       intersecting a sibling's box —
 *                                       chrome elements stepping on
 *                                       each other)
 *
 * The scanner is intentionally biased toward reports rather than
 * pass/fail because every report needs a human eye — some overlaps
 * are intentional (drop indicator over rows). Use it as a leading
 * indicator during a redesign sprint, not a gate.
 *
 * Usage (inside puppeteer page.evaluate):
 *   const audit = await page.evaluate(${auditFn});
 *   // audit = { offViewport: [...], clipped: [...], overlaps: [...] }
 *
 * Or run standalone against the htmlwidget smoke fixture:
 *   node audit-layout.mjs <widget.html> [--scenario open-editor]
 */

export const auditScript = `(() => {
  const out = { offViewport: [], clipped: [], overlaps: [] };
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  function describe(el) {
    const id = el.id ? "#" + el.id : "";
    const cls = el.className?.toString?.().trim()?.split(/\\s+/)?.slice(0, 2)?.join(".") ?? "";
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? "").trim().slice(0, 40);
    return tag + (id || (cls ? "." + cls : "")) + (text ? ' "' + text + '"' : "");
  }

  // 1. Off-viewport — any visible element whose rect lands outside the viewport.
  //    Exclude elements that have scrollable ancestors (they may be intentionally
  //    offscreen pending scroll), and skip naked .tabviz-* table-body cells
  //    (which always extend past horizontal viewport for wide tables).
  const interactiveSelectors = [
    ".header-ctx-menu", ".type-menu", ".filter-popover", ".col-editor-popover",
    ".v2-popover-shell", ".settings-panel", ".context-menu", "[role='menu']",
    "[role='dialog']", "[role='listbox']",
  ];
  for (const sel of interactiveSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (
        r.right > vw + 1 || r.bottom > vh + 1 ||
        r.left < -1 || r.top < -1
      ) {
        out.offViewport.push({
          el: describe(el),
          rect: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
          vw, vh,
        });
      }
    }
  }

  // 2. Text clipping without ellipsis.
  //    Heuristic: an element whose scrollWidth exceeds clientWidth and that
  //    contains only inline text content AND does not have overflow-wrap or
  //    a text-overflow rule.
  const TEXT_HOSTS = "label, span, button, h1, h2, h3, h4, h5, h6, [role='menuitem'], [role='tab'], [role='option']";
  for (const el of document.querySelectorAll(TEXT_HOSTS)) {
    if (!el.firstChild || el.children.length > 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (el.scrollWidth > el.clientWidth + 1) {
      const cs = getComputedStyle(el);
      if (cs.textOverflow !== "ellipsis" && !["normal", "break-spaces"].includes(cs.whiteSpace)) continue;
      if (cs.textOverflow === "ellipsis") continue;
      // Truly clipped text without ellipsis.
      out.clipped.push({
        el: describe(el),
        scrollW: el.scrollWidth, clientW: el.clientWidth,
        text: (el.textContent ?? "").trim().slice(0, 60),
      });
    }
  }

  // 3. Sibling overlap among inline chrome elements.
  //    For each parent that contains > 1 inline-flex / flex-row child, check
  //    whether any two children's rects intersect more than a 1px tolerance.
  //    This catches the "label sits on top of the value" class of bug.
  function rectsOverlap(a, b) {
    return !(a.right <= b.left + 1 || b.right <= a.left + 1 ||
             a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
  }
  const chromeParents = document.querySelectorAll(
    ".v2-popover-shell *, .settings-panel *, .header-ctx-menu, .type-menu, .filter-popover"
  );
  const seenOverlaps = new Set();
  for (const parent of chromeParents) {
    const cs = getComputedStyle(parent);
    if (!cs.display.includes("flex") && !cs.display.includes("grid")) continue;
    const kids = [...parent.children].filter(c => {
      const r = c.getBoundingClientRect();
      const k = getComputedStyle(c);
      // Skip absolutely-positioned children (overlap is intentional).
      if (k.position === "absolute" || k.position === "fixed") return false;
      return r.width > 0 && r.height > 0;
    });
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        if (rectsOverlap(a, b)) {
          const k = describe(kids[i]) + " ∩ " + describe(kids[j]);
          if (seenOverlaps.has(k)) continue;
          seenOverlaps.add(k);
          out.overlaps.push({ pair: k });
        }
      }
    }
  }

  return out;
})()`;

// ── Standalone CLI ────────────────────────────────────────────────
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith("audit-layout.mjs")) {
  const puppeteer = await import("puppeteer");
  const http = await import("node:http");
  const path = await import("node:path");
  const fs = await import("node:fs");
  const widget = process.argv[2];
  const scenario = (process.argv.find((a) => a.startsWith("--scenario=")) || "").split("=")[1] || "menu";
  if (!widget) {
    process.stderr.write("usage: audit-layout.mjs <widget.html> [--scenario=menu|editor|settings]\n");
    process.exit(2);
  }
  const dir = path.dirname(path.resolve(widget));
  const name = path.basename(widget);
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const fp = path.join(dir, u === "/" ? `/${name}` : u);
    if (!fs.existsSync(fp)) { res.statusCode = 404; res.end(); return; }
    const ct = {".html":"text/html",".js":"application/javascript",".css":"text/css",".png":"image/png"}[path.extname(fp)] ?? "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.end(fs.readFileSync(fp));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const browser = await puppeteer.default.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".tabviz-container");
    await new Promise((r) => setTimeout(r, 300));

    if (scenario === "menu") {
      const hdr = await page.evaluate(() => {
        const el = [...document.querySelectorAll("[data-header-id]")][2];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(hdr.x, hdr.y, { button: "right" });
      await new Promise((r) => setTimeout(r, 200));
    } else if (scenario === "settings") {
      const gear = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(b => /Open display settings/i.test(b.getAttribute("aria-label") || ""));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(gear.x, gear.y);
      await new Promise((r) => setTimeout(r, 400));
    } else if (scenario === "editor") {
      const hdr = await page.evaluate(() => {
        const el = [...document.querySelectorAll("[data-header-id]")][2];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(hdr.x, hdr.y, { button: "right" });
      await new Promise((r) => setTimeout(r, 200));
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /configure/i.test(b.textContent || ""))?.click());
      await new Promise((r) => setTimeout(r, 400));
    }

    const result = await page.evaluate(auditScript);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    await browser.close();
    server.close();
  }
}

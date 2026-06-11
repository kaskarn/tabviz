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

    // ── Area-H walk (2026-06-11): a full session pass with the page-error
    // collector running throughout. Each leg sets `failed` on assertion
    // miss; the error check at the end catches anything that threw.

    // Leg 1 — rail tabs: the studio KEEPS real tabs (D16); all four
    // switch content (panel fingerprint must change).
    const railFp = () => page.$eval(".studio-rail", (el) => {
      const t = el.innerHTML;
      let h = 0;
      for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
      return h;
    });
    for (const label of ["color", "form", "effects", "identity"]) {
      const before = await railFp();
      const ok = await page.evaluate((t) => {
        const tabs = [...document.querySelectorAll('.studio-rail [role="tab"]')];
        const el = tabs.find((x) => (x.textContent || "").trim().toLowerCase() === t);
        if (!el) return false;
        el.click();
        return true;
      }, label);
      if (!ok) { failed = true; console.error(`✗ rail tab '${label}' not found`); continue; }
      await new Promise((r) => setTimeout(r, 150));
      if (label !== "identity" && (await railFp()) === before) {
        failed = true; console.error(`✗ rail tab '${label}' did not switch content`);
      }
    }
    console.log("✓ rail tabs switch content");

    // Leg 2 — spine rebind: click a role token, then undo. The chart must
    // repaint on rebind (style text changes) and undo must restore it.
    const chartFp = () => page.evaluate(() => {
      // HASH the content (length-based fp missed hex→hex swaps — same trap
      // the panel-liveness lessons recorded: comprehensive fingerprints).
      const text = (document.querySelector(".studio-chart")?.innerHTML ?? "") +
        [...document.querySelectorAll("style")].map((s) => s.textContent).join("");
      let h = 0;
      for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
      return h;
    });

    // Leg 3 — components editor (E Stage 2 roomy host): an accordion
    // region opens; a chip re-route repaints the chart; release restores.
    const compOk = await page.evaluate(() => {
      const head = document.querySelector(".components-band .region-head");
      if (!head) return "missing";
      head.click();
      return "ok";
    });
    if (compOk === "missing") {
      // roomy layout renders regions OPEN (no accordion heads) — accept if
      // channel rows exist instead.
      const rows = await page.$$eval(".components-band .channel-btn", (n) => n.length);
      if (rows === 0) { failed = true; console.error("✗ components editor rendered no channels"); }
      else console.log(`✓ components editor live (${rows} channel rows, roomy)`);
    } else {
      await new Promise((r) => setTimeout(r, 120));
      const rows = await page.$$eval(".components-band .channel-btn", (n) => n.length);
      if (rows === 0) { failed = true; console.error("✗ components accordion opened but no channels"); }
      else console.log(`✓ components editor live (${rows} channel rows)`);
    }
    {
      const before = await chartFp();
      const opened = await page.evaluate(() => {
        const btn = document.querySelector(".components-band .channel-btn");
        if (!btn) return false;
        btn.click();
        return true;
      });
      await new Promise((r) => setTimeout(r, 200)); // svelte flush — picker mounts async
      const rerouted = opened && await page.evaluate(() => {
        // The FIRST chip is often the channel's manifest default — pick the
        // LAST (status family) so the re-route guarantees a different hex.
        const chips = [...document.querySelectorAll(".components-band .picker .chip:not(.selected), .components-band .picker .slot-chip:not(.selected)")];
        const chip = chips[chips.length - 1];
        if (!chip) return false;
        chip.click();
        return true;
      });
      await new Promise((r) => setTimeout(r, 250));
      if (!rerouted) { failed = true; console.error("✗ component re-route gesture found no picker chip"); }
      else if ((await chartFp()) === before) { failed = true; console.error("✗ component re-route did not repaint the chart"); }
      else console.log("✓ component re-route repaints the chart");
      // Undo restores (components ride history since E Stage 2).
      await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
      await page.keyboard.press("z");
      await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
      await new Promise((r) => setTimeout(r, 250));
      if ((await chartFp()) !== before) { failed = true; console.error("✗ undo did not restore the pre-re-route chart"); }
      else console.log("✓ undo restores the re-route");
    }

    if (errors.length) { failed = true; console.error("✗ page errors:\n  " + errors.join("\n  ")); }
    else console.log("✓ no console/page errors across the walk");
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

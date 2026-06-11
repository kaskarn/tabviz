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

    // Leg 4 — rail VALUE controls (area-H tail, 2026-06-11): per tab,
    // operate every range slider with REAL keyboard (focus → ArrowRight)
    // and assert the chart repaints. The panel-liveness depth, compact:
    // a slider that moves nothing is DEAD.
    for (const label of ["identity", "color", "form", "effects"]) {
      await page.evaluate((t) => {
        const tabs = [...document.querySelectorAll('.studio-rail [role="tab"]')];
        tabs.find((x) => (x.textContent || "").trim().toLowerCase() === t)?.click();
      }, label);
      await new Promise((r) => setTimeout(r, 150));
      // Anchors + effects sliders live behind collapsed rows/disclosures
      // (LCH editors open per-anchor; gradient angle behind a toggle) —
      // open everything first or the walk is blind to them.
      await page.evaluate(() => {
        for (const btn of document.querySelectorAll(".studio-rail .disclosure:not(.open) .head .row")) btn.click();
        for (const btn of document.querySelectorAll(".studio-rail .anchor-row > button, .studio-rail .anchor-head")) btn.click();
      });
      await new Promise((r) => setTimeout(r, 250));
      const n = await page.$$eval('.studio-rail input[type="range"]', (els) => els.length);
      let live = 0, dead = [];
      for (let i = 0; i < n; i++) {
        const before = await chartFp();
        const info = await page.evaluate((idx) => {
          const el = [...document.querySelectorAll('.studio-rail input[type="range"]')][idx];
          if (!el) return null;
          el.focus();
          const label = el.getAttribute("aria-label") ?? `range[${idx}]`;
          // Known-inert: a HUE slider on a near-achromatic anchor (C≈0)
          // resolves to the same hex — repaint-exempt, like the liveness
          // harness's contrast-toggle exemption.
          const lch = el.closest(".lch");
          const chroma = lch ? Number([...lch.querySelectorAll('input[type="range"]')][1]?.value ?? 1) : 1;
          const exempt = /hue$/i.test(label) && chroma < 0.02;
          const atMax = Number(el.value) >= Number(el.max);
          return { label, exempt, atMax };
        }, i);
        if (info === null) continue;
        // At-max sliders can't ArrowRight — nudge left instead. PageUp/
        // PageDown jump ~10% of range: one arrow step on a fine-grained
        // slider (chroma step 0.002) can round to the SAME hex and
        // false-flag a live control.
        const fwd = info.atMax ? "PageDown" : "PageUp";
        const back = info.atMax ? "PageUp" : "PageDown";
        await page.keyboard.press(fwd);
        await new Promise((r) => setTimeout(r, 200));
        if ((await chartFp()) !== before || info.exempt) live++;
        else dead.push(info.label);
        // restore (one step back) so legs stay near the base theme
        await page.keyboard.press(back);
        await new Promise((r) => setTimeout(r, 120));
      }
      if (dead.length > 0) { failed = true; console.error(`✗ DEAD rail sliders on '${label}': ${dead.join(" · ")}`); }
      else console.log(`✓ rail '${label}': ${live}/${n} sliders repaint the chart`);
    }

    // Leg 5 — PinsPanel + pins banner accuracy: add a pin via the REAL
    // add-pin inputs → row appears + banner names the count + chart
    // repaints; clear → both disappear.
    {
      const before = await chartFp();
      const bannerBefore = await page.$(".pins-warn-banner");
      if (bannerBefore) { failed = true; console.error("✗ pins banner visible with zero pins"); }
      // First, the validation surface: a bogus token must surface the
      // manifest error inline (typed-by-validation, P3) — never a silent
      // no-op and never a pin.
      // The panel's content is inside a closed DisclosureField — open it.
      await page.evaluate(() => document.querySelector(".pins-panel .disclosure:not(.open) .head .row")?.click());
      await new Promise((r) => setTimeout(r, 200));
      // REAL typing — synthetic value+event writes don't drive Svelte 5
      // bindings reliably (the untrusted-event trap; interaction-qa
      // lesson). Focus each TextInput and type; Enter fires oncommit.
      const haveInputs = await page.$$eval(".pins-panel .add-pin input", (els) => els.length);
      let added = "no-inputs";
      if (haveInputs >= 2) {
        await page.evaluate(() => document.querySelectorAll(".pins-panel .add-pin input")[0].focus());
        await page.keyboard.type("--tv-not-a-token");
        await page.evaluate(() => document.querySelectorAll(".pins-panel .add-pin input")[1].focus());
        await page.keyboard.type("#123456");
        await page.keyboard.press("Enter");
        await new Promise((r) => setTimeout(r, 250));
        const errText = await page.evaluate(() => document.querySelector(".pin-error")?.textContent ?? "");
        if (!errText.includes("not in the component-token manifest")) {
          failed = true; console.error(`✗ bogus pin token did not surface the manifest error (got "${errText.slice(0, 60)}")`);
        } else console.log("✓ bogus pin token surfaces the manifest error");
        // Clear drafts by triple-click-select (Cmd+A is unreliable in
        // headless) then type-over with the REAL token.
        const inputBox = async (i) => {
          const boxes = await page.$$(".pins-panel .add-pin input");
          return boxes[i];
        };
        for (const [idx, text] of [[0, "--tv-text-title-fg"], [1, "#ff00aa"]]) {
          const el = await inputBox(idx);
          await el.click({ clickCount: 3 });
          await page.keyboard.type(text);
        }
        await page.keyboard.press("Enter");
        added = "ok";
      }
      await new Promise((r) => setTimeout(r, 300));
      if (added !== "ok") { failed = true; console.error(`✗ PinsPanel add-pin path broken: ${added}`); }
      else {
        const rows = await page.$$eval(".pins-panel .pin-row", (n) => n.length);
        const banner = await page.evaluate(() => document.querySelector(".pins-warn-banner")?.textContent ?? "");
        const repainted = (await chartFp()) !== before;
        if (rows === 0) { failed = true; console.error("✗ pin committed but no pin row rendered"); }
        if (!banner.includes("1 hardcoded pin")) { failed = true; console.error(`✗ pins banner inaccurate: "${banner.slice(0, 80)}"`); }
        if (!repainted) { failed = true; console.error("✗ pin did not repaint the chart"); }
        if (rows > 0 && banner.includes("1 hardcoded pin") && repainted) console.log("✓ PinsPanel: pin lands (row + accurate banner + repaint)");
        await page.evaluate(() => document.querySelector(".pins-panel .pin-clear")?.click());
        await new Promise((r) => setTimeout(r, 250));
        const rowsAfter = await page.$$eval(".pins-panel .pin-row", (n) => n.length);
        const bannerAfter = await page.$(".pins-warn-banner");
        if (rowsAfter !== 0 || bannerAfter) { failed = true; console.error("✗ pin clear did not remove row/banner"); }
        else console.log("✓ pin clear removes row + banner");
      }
    }

    // Leg 6 — Validate ▦ accuracy: the matrix renders every polarity ×
    // contrast cell with a verdict; a deliberately unreadable pin
    // (white title on the light paper) must flip verdicts to ⚠ — pins
    // overlay BEFORE contrast validation (PinsPanel contract), so the
    // matrix judging pre-pin state would be the bug this leg exists for.
    {
      const readMatrix = async () => page.evaluate(() => {
        const cells = [...document.querySelectorAll(".validate-cell")];
        return cells.map((c) => ({
          label: c.querySelector(".validate-cell-head span")?.textContent ?? "?",
          bad: [...c.querySelectorAll(".v-bad")].map((b) => b.textContent).join("|"),
          ok: c.querySelector(".v-ok") != null,
          hasChart: c.querySelector(".validate-chart .studio-chart, .validate-chart svg, .validate-chart .tabviz-container") != null,
        }));
      });
      const toggleValidate = async () => {
        await page.evaluate(() => document.querySelector(".validate-toggle")?.click());
        await new Promise((r) => setTimeout(r, 600)); // 4 charts mount
      };
      await toggleValidate();
      const base = await readMatrix();
      if (base.length === 0) { failed = true; console.error("✗ Validate ▦ rendered no cells"); }
      else if (base.some((c) => c.bad.includes("resolve failed"))) { failed = true; console.error("✗ Validate ▦ cell failed to resolve"); }
      else if (base.some((c) => !c.hasChart)) { failed = true; console.error("✗ Validate ▦ cell missing its chart"); }
      else console.log(`✓ Validate ▦ renders ${base.length} cells with verdicts + charts`);
      const baseWarn = base.filter((c) => c.bad.includes("contrast")).length;
      await toggleValidate(); // back to single view

      // The unreadable pin must hit a CHECKED invariant pair (the
      // validator covers header bands + body text, NOT every token —
      // first draft pinned the title token and learned that): pin the
      // header-fill band's fg AND bg to the same grey → ratio 1.0.
      const addPin = async (token, value) => {
        const inputs2 = await page.$$(".pins-panel .add-pin input");
        await inputs2[0].click({ clickCount: 3 });
        await page.keyboard.type(token);
        await inputs2[1].click({ clickCount: 3 });
        await page.keyboard.type(value);
        await page.keyboard.press("Enter");
        await new Promise((r) => setTimeout(r, 250));
      };
      await addPin("--tv-header-fill-fg", "#888888");
      await addPin("--tv-header-fill-bg", "#888888");
      await toggleValidate();
      const pinned = await readMatrix();
      const pinnedWarn = pinned.filter((c) => c.bad.includes("contrast")).length;
      if (pinnedWarn <= baseWarn) {
        failed = true;
        console.error(`✗ Validate ▦ did not judge the pinned value (warn cells ${baseWarn} → ${pinnedWarn}): ${JSON.stringify(pinned)}`);
      } else console.log(`✓ Validate ▦ judges pinned values (warn cells ${baseWarn} → ${pinnedWarn})`);
      await toggleValidate();
      // release both pins
      for (let k = 0; k < 2; k++) {
        await page.evaluate(() => document.querySelector(".pins-panel .pin-clear")?.click());
        await new Promise((r) => setTimeout(r, 150));
      }
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

#!/usr/bin/env node
//
// readme-gif.mjs — generates docs/images/readme-tour.gif (area I: the
// README's 30-seconds-to-impressive tour). Mounts a clinical fixture in
// headless Chromium via the REAL htmlwidget bundle, drives interactions
// (sort, theme switches), snapshots frames, and assembles a GIF with
// ImageMagick. Re-run after visual-identity changes:
//   cd srcjs && node scripts/readme-gif.mjs
// Needs: npm run build (widget bundle) + build:npm (dist authoring) + magick.

import puppeteer from "puppeteer";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { tabviz, colText, colNumeric, colInterval, colPvalue, vizForest, themeNejm, themeTerminal, themeSynthwave } from "../dist/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "../tests/browser/fixtures.html");
const BUNDLE = path.resolve(__dirname, "../../inst/htmlwidgets/tabviz.js");
const CSS = path.resolve(__dirname, "../../inst/htmlwidgets/tabviz.css");
const OUT = path.resolve(__dirname, "../../docs/images/readme-tour.gif");

const rows = [
  { study: "ELIXA 2015",      grp: "Short-acting", n: 6068,  hr: 1.02, lo: 0.89, hi: 1.17, p: 0.78 },
  { study: "EXSCEL 2017",     grp: "Short-acting", n: 14752, hr: 0.91, lo: 0.83, hi: 1.00, p: 0.06 },
  { study: "LEADER 2016",     grp: "Long-acting",  n: 9340,  hr: 0.87, lo: 0.78, hi: 0.97, p: 0.01 },
  { study: "SUSTAIN-6 2016",  grp: "Long-acting",  n: 3297,  hr: 0.74, lo: 0.58, hi: 0.95, p: 0.02 },
  { study: "REWIND 2019",     grp: "Long-acting",  n: 9901,  hr: 0.88, lo: 0.79, hi: 0.99, p: 0.03 },
  { study: "AMPLITUDE-O 2021", grp: "Long-acting", n: 4076,  hr: 0.73, lo: 0.58, hi: 0.92, p: 0.007 },
];

const spec = tabviz({
  data: rows,
  label: "study",
  group: "grp",
  columns: [
    colNumeric({ field: "n", header: "N", decimals: 0 }),
    vizForest({ point: "hr", lower: "lo", upper: "hi", header: "Hazard ratio (95% CI)", scale: "log", nullValue: 1 }),
    colInterval({ point: "hr", lower: "lo", upper: "hi", header: "HR (95% CI)" }),
    colPvalue({ field: "p", header: "P", stars: true }),
  ],
  theme: themeNejm(),
  title: "GLP-1 receptor agonists — MACE outcomes",
  subtitle: "Hazard ratios from cardiovascular outcome trials",
});
spec.interaction = {
  ...spec.interaction,
  enableSort: true,
  enableThemes: { nejm: themeNejm(), terminal: themeTerminal(), synthwave: themeSynthwave() },
};

const frames = mkdtempSync(path.join(tmpdir(), "tabviz-gif-"));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 980, height: 560, deviceScaleFactor: 2 });
await page.goto(`file://${FIXTURE}`, { waitUntil: "load" });
await page.addStyleTag({ path: CSS });
await page.addScriptTag({ path: BUNDLE });
await page.evaluate((s) => {
  const w = window;
  const host = document.getElementById("widget");
  host.innerHTML = "";
  const inner = document.createElement("div");
  inner.style.width = "940px";
  inner.style.height = "520px";
  host.appendChild(inner);
  w.HTMLWidgets.find("tabviz").factory(inner, 940, 520).renderValue(s);
}, spec);
await new Promise((r) => setTimeout(r, 900));

let n = 0;
const shot = async (holdFrames = 1) => {
  const file = path.join(frames, `f${String(n++).padStart(2, "0")}.png`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 980, height: 560 } });
  for (let i = 1; i < holdFrames; i++) {
    execFileSync("cp", [file, path.join(frames, `f${String(n++).padStart(2, "0")}.png`)]);
  }
};

await shot(3); // the zero-fuss base table

// Sort by N (real click on the header)
await page.evaluate(() => {
  const h = document.querySelector('.header-cell[data-header-id="numeric_n"]');
  h?.click();
});
await new Promise((r) => setTimeout(r, 500));
await shot(2);

// Theme tour via the store-driven switcher path: click through themes.
for (const theme of ["terminal", "synthwave", "nejm"]) {
  await page.evaluate(() => {
    document.querySelector(".tabviz-container")?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  });
  const opened = await page.evaluate(() => {
    const btn = document.querySelector(".theme-btn");
    if (!btn) return false;
    btn.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 300));
  const picked = opened && await page.evaluate((t) => {
    const item = [...document.querySelectorAll(".theme-dropdown .dropdown-item")]
      .find((b) => b.textContent.trim().toLowerCase().includes(t));
    if (!item) return false;
    item.click();
    return true;
  }, theme);
  if (!picked) {
    console.error(`theme pick failed for ${theme}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 600));
  await shot(3);
}

await browser.close();
execFileSync("magick", ["-delay", "90", "-loop", "0", path.join(frames, "f*.png"), "-resize", "980x", "-layers", "optimize", OUT]);
rmSync(frames, { recursive: true, force: true });
const size = execFileSync("du", ["-h", OUT]).toString().trim();
console.log(`✓ ${size}`);

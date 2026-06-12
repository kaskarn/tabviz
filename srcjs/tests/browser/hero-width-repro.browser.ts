// OPEN DEFECT REPRO (2026-06-12, sizing audit follow-up): the docs hero
// (R wire, container 799) renders its interval column at 130px against
// 138px of content — and the grid template is BYTE-INVARIANT across
// three different width-logic versions (flat naturals → estimator
// floors → canvas floors), while the SAME logic driven directly
// (floor-probe unit chain) floors correctly at ≥139. Some width path
// for R-wire specs bypasses layout-zoom's flexSpecs — unidentified.
// Run: bun run tests/browser/hero-width-repro.browser.ts
// Expect (fixed): ivW >= ivSW. Today: 108 < 138.
import puppeteer from "puppeteer";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(path.join(__dirname, "fixtures/hero-embedded.json"), "utf8"));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`file://${path.join(__dirname, "fixtures.html")}`, { waitUntil: "load" });
await page.addStyleTag({ path: path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css") });
await page.addScriptTag({ path: path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js") });
await page.evaluate((s) => {
  const w = window as never as { HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, a: number, b: number) => { renderValue: (x: unknown) => void } } } };
  const host = document.getElementById("widget")!;
  const inner = document.createElement("div");
  inner.style.width = "799px"; inner.style.height = "900px";
  host.appendChild(inner);
  w.HTMLWidgets.find("tabviz").factory(inner, 799, 900).renderValue(s);
}, spec as never);
await new Promise((r) => setTimeout(r, 1200));
const probe = await page.evaluate(() => {
  const grid = document.querySelector(".tabviz-main") as HTMLElement;
  const iv = [...document.querySelectorAll('[data-field]')].find((c) => c.textContent!.includes("(0.58"));
  return { template: grid.style.gridTemplateColumns, ivW: iv ? Math.round(iv.getBoundingClientRect().width) : null, ivSW: iv ? (iv as HTMLElement).scrollWidth : null };
});
console.log(JSON.stringify(probe));
await browser.close();

/**
 * Live Shiny smoke driver (Arc A2, 2026-06-05). Companion to app.R.
 *
 * Verifies the three Shiny integration layers against a REAL running app
 * (beyond the mocked-session unit tests in tests/testthat/test-shiny-*.R):
 *   1. renderTabviz mounts the widget (rows present);
 *   2. tabviz_proxy() |> set_theme() applies live (data-polarity flips);
 *   3. an interactive edit (real dblclick + keys) commits in the DOM AND
 *      round-trips to the server (input$tv_cell_edits echo).
 *
 * Run:
 *   Rscript -e 'shiny::runApp("tests/manual/shiny-smoke", port = 8742)' &
 *   cd srcjs && bun run ../tests/manual/shiny-smoke/drive.ts
 * Exits non-zero on any failure. NOTE: drives the INSTALLED package —
 * devtools::install(quick = TRUE) after bundle changes or you smoke a
 * stale bundle (that mistake found a "regression" that was just staleness).
 */
import puppeteer from "puppeteer";

const URL = process.env.SMOKE_URL ?? "http://localhost:8742";

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const b = await puppeteer.launch({ headless: true, args: ["--no-sandbox"], protocolTimeout: 120000 });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 900 });
const errs: string[] = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 150)));
await p.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const rows = await p.evaluate(() => document.querySelectorAll(".primary-cell:not(.group-row)").length);
if (rows < 1) fail(`widget did not render (rows=${rows})`);
console.log(`✓ render: ${rows} rows`);

await p.click("#go_dark");
await new Promise((r) => setTimeout(r, 1500));
const pol = await p.evaluate(() => document.querySelector(".tabviz-container")?.getAttribute("data-polarity"));
if (pol !== "dark") fail(`proxy set_theme did not apply (data-polarity=${pol})`);
console.log("✓ proxy set_theme: polarity → dark");

const target = await p.evaluate(() => {
  const cell = [...document.querySelectorAll<HTMLElement>(".numeric-cell[data-row-id]")][0]!;
  const r = cell.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.click(target.x, target.y, { clickCount: 2 });
await new Promise((r) => setTimeout(r, 600));
await p.keyboard.type("999");
await p.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 1500));
const echo = await p.evaluate(() => document.querySelector("#echo_edits")?.textContent ?? "");
const cellTxt = await p.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>(".numeric-cell[data-row-id]")][0]?.textContent?.trim());
if (cellTxt !== "999") fail(`edit did not commit in DOM (cell shows ${cellTxt})`);
if (!echo.includes("999")) fail("edit did not round-trip to input$tv_cell_edits");
console.log("✓ edit: DOM commit + Shiny input round-trip");

if (errs.length) fail(`page errors: ${errs.join(" | ")}`);
console.log("✓ no page errors\nShiny smoke passed.");
await b.close();

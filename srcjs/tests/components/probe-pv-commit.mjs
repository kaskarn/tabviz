#!/usr/bin/env node
import puppeteer from "puppeteer";
import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const widget = "/tmp/pv.html";
const dir = path.dirname(widget); const name = path.basename(widget);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const fp = path.join(dir, u === "/" ? `/${name}` : u);
  if (!existsSync(fp)) { res.statusCode = 404; res.end(); return; }
  res.setHeader("Content-Type","text/html"); res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });
  page.on("console", (m) => process.stdout.write(`[${m.type()}] ${m.text()}\n`));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".tabviz-container");
  await new Promise((r) => setTimeout(r, 400));

  const target = await page.evaluate(() => {
    const el = [...document.querySelectorAll("[data-header-id]")].find(e => (e.textContent || "").trim() === "P");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(target.x, target.y, { button: "right" });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button, [role='menuitem']")].find(x => /configure/i.test(x.textContent || ""));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // Find the "Sig. digits" field — its label is "Sig. digits".
  const sigLabel = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("label.label")];
    const el = labels.find(l => /sig\. digits/i.test(l.textContent || ""));
    if (!el) return null;
    // The Knob's input is the next sibling .control area > .knob > .chip > input
    const field = el.closest(".field");
    const input = field?.querySelector("input[type='text']");
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, value: input.value };
  });
  console.log("Sig digits input:", JSON.stringify(sigLabel));
  if (!sigLabel) process.exit(1);

  // Click into it, clear, type 4.
  await page.mouse.click(sigLabel.x, sigLabel.y);
  await new Promise((r) => setTimeout(r, 100));
  const focusInfo = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    val: document.activeElement?.value,
  }));
  console.log("focused:", JSON.stringify(focusInfo));

  // Triple-click to select then type.
  await page.mouse.click(sigLabel.x, sigLabel.y, { clickCount: 3 });
  await new Promise((r) => setTimeout(r, 80));
  await page.keyboard.type("4");
  await new Promise((r) => setTimeout(r, 100));

  const beforeBlur = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("label.label")];
    const el = labels.find(l => /sig\. digits/i.test(l.textContent || ""));
    const input = el?.closest(".field")?.querySelector("input[type='text']");
    return { val: input?.value, raw: input?.value };
  });
  console.log("before blur (typed):", JSON.stringify(beforeBlur));

  // Explicit blur via JS dispatch.
  await page.evaluate(() => {
    const labels = [...document.querySelectorAll("label.label")];
    const el = labels.find(l => /sig\. digits/i.test(l.textContent || ""));
    const input = el?.closest(".field")?.querySelector("input[type='text']");
    input?.blur();
  });
  await new Promise((r) => setTimeout(r, 200));

  const after = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("label.label")];
    const el = labels.find(l => /sig\. digits/i.test(l.textContent || ""));
    const input = el?.closest(".field")?.querySelector("input[type='text']");
    return { val: input?.value };
  });
  console.log("Sig. digits after typing 4 + Tab:", JSON.stringify(after));

  // Also click Save and inspect the column spec by triggering serialization.
  await page.evaluate(() => {
    const save = [...document.querySelectorAll("button")].find(b => /^Save$/.test((b.textContent||"").trim()));
    save?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // The widget's data-tabviz-spec attribute or the htmlwidget data may
  // contain the updated column. Let's dump the columns the rendered
  // table now has from data-header-id presence (simpler).
  const updated = await page.evaluate(() => {
    // Use the global op-log endpoint if accessible.
    const widgets = window.HTMLWidgets?.find?.("tabviz") || [];
    return widgets;
  });
  console.log("widgets:", typeof updated);
} finally {
  await browser.close();
  server.close();
}

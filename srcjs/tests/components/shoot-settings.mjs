// Shoot one PNG per menu of the SettingsScaffold scenario. Each shot
// captures the panel + tab picker at a fixed viewport so the
// frontend-design agents have a concrete artifact to critique.

import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";

const URL_BASE = "http://localhost:4477/harness.html#v2-settings-scaffold";
const OUT_DIR  = path.resolve(import.meta.dirname, "settings-shots");

const TABS = [
  "theme", "layout", "spacing", "viz", "text", "tokens", "basics", "watermark",
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 });
await page.goto(URL_BASE, { waitUntil: "networkidle0" });
await fs.mkdir(OUT_DIR, { recursive: true });

// Wait for scaffold mount.
await page.waitForSelector(".scaffold", { timeout: 5000 });

for (const id of TABS) {
  // Click the matching tab in the right-rail picker. Pickers use the
  // tab label as their text; build a small map to click by label.
  const labels = {
    theme: "Theme", layout: "Layout", spacing: "Spacing", viz: "Marks",
    text: "Text",  tokens: "Tokens",  basics: "Labels",  watermark: "Watermark",
  };
  await page.evaluate((label) => {
    const btns = Array.from(document.querySelectorAll(".picker-btn"));
    const btn = btns.find((b) => b.textContent.trim() === label);
    if (btn) btn.click();
  }, labels[id]);
  await new Promise((r) => setTimeout(r, 150));
  const target = await page.$(".scaffold");
  const filename = path.join(OUT_DIR, `${id}.png`);
  await target.screenshot({ path: filename });
  console.log(`✓ ${filename}`);
}

await browser.close();

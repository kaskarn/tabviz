import puppeteer from "puppeteer";
import path from "node:path";
const fileUrl = "file://" + path.resolve("/Users/antoine/dev/r/forest/docs/_site/index.html");
const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
await p.goto(fileUrl, { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1500));

// Open settings
await p.evaluate(() => {
  const btn = document.querySelector('[aria-label*="ettings"], .settings-button');
  btn?.click();
});
await new Promise(r => setTimeout(r, 600));

// Inspect tab structure
const tabs = await p.evaluate(() => {
  const settingsTabs = Array.from(document.querySelectorAll(".tab-bar button, .tab-bar [role='tab'], [class*='tab']"));
  return settingsTabs.slice(0, 12).map(t => ({
    tag: t.tagName,
    cls: t.className.toString().slice(0, 80),
    txt: (t.textContent || "").trim().slice(0, 50),
  }));
});
console.log("tabs found:", JSON.stringify(tabs, null, 2));
await b.close();

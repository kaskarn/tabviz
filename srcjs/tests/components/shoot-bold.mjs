import puppeteer from "puppeteer";
import path from "node:path";
const fileUrl = "file://" + path.resolve("/Users/antoine/dev/r/forest/docs/_site/index.html");
const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
await p.goto(fileUrl, { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1500));

await p.evaluate(() => {
  const sBtn = document.querySelector('[aria-label*="ettings"], .settings-button');
  sBtn?.click();
});
await new Promise(r => setTimeout(r, 400));
await p.evaluate(() => {
  const tab = Array.from(document.querySelectorAll("button"))
    .find(b => /^\s*Layout\s*$/.test(b.textContent || ""));
  tab?.click();
});
await new Promise(r => setTimeout(r, 400));

// Click Bold header card
await p.evaluate(() => {
  // The Header sub-section uses density-card class. Find the card with
  // text "Bold" in the Header strip.
  const cards = Array.from(document.querySelectorAll(".density-card"));
  for (const c of cards) {
    if (c.querySelector(".density-label")?.textContent?.trim() === "Bold") {
      c.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 600));

await p.screenshot({ path: path.resolve(import.meta.dirname, "settings-shots", "bold-header.png"), clip: { x: 0, y: 0, width: 1000, height: 600 } });
console.log("shot saved");
await b.close();

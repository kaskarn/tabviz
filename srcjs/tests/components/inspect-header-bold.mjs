import puppeteer from "puppeteer";
import path from "node:path";
const fileUrl = "file://" + path.resolve("/Users/antoine/dev/r/forest/docs/_site/index.html");
const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
await p.goto(fileUrl, { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1200));

// Try to switch headerStyle to "bold" via the store (via the DOM panel)
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

// Click "Bold" header card
const clicked = await p.evaluate(() => {
  const cards = Array.from(document.querySelectorAll(".density-card"));
  const bold = cards.find(c => /^\s*Bold\s*$/.test(c.textContent || ""));
  bold?.click();
  return !!bold;
});
console.log("clicked bold:", clicked);
await new Promise(r => setTimeout(r, 500));

// Inspect a header cell
const info = await p.evaluate(() => {
  const hcells = Array.from(document.querySelectorAll(".header-cell"));
  return hcells.slice(0, 4).map(h => {
    const cs = getComputedStyle(h);
    return {
      cls: h.className.slice(0, 80),
      bg: cs.backgroundColor,
      borderRight: `${cs.borderRightWidth} ${cs.borderRightStyle} ${cs.borderRightColor}`,
      borderRightStyleVar: cs.getPropertyValue("--tv-border-col-style"),
      gridCol: cs.gridColumn,
    };
  });
});
console.log(JSON.stringify(info, null, 2));
await b.close();

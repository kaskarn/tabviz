import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 });
await p.goto("http://localhost:4477/harness.html#v2-settings-scaffold", { waitUntil: "networkidle0" });
await p.evaluate(() => {
  const btn = Array.from(document.querySelectorAll(".picker-btn")).find(b => b.textContent.trim() === "Layout");
  btn?.click();
});
await new Promise(r => setTimeout(r, 800));
// Count layout-card elements and their visibility
const info = await p.evaluate(() => {
  const cards = Array.from(document.querySelectorAll(".layout-card"));
  return cards.map((c, i) => {
    const rect = c.getBoundingClientRect();
    return { i, label: c.textContent?.trim().slice(0, 12) || "", top: rect.top, height: rect.height, visible: rect.height > 0 };
  });
});
console.log("layout-card elements:", JSON.stringify(info, null, 2));
await b.close();

import puppeteer from "puppeteer";
import path from "path";

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
page.on("console", (m) => console.log("CONSOLE:", m.type(), m.text()));
await page.goto(`file://${path.resolve(process.argv[2])}`, { waitUntil: "networkidle0" });
await page.waitForSelector(".split-sidebar", { timeout: 10000 });
await new Promise(r => setTimeout(r, 300));

// Inspect tree nodes
const nodes = await page.evaluate(() => {
  const btns = document.querySelectorAll(".node-btn");
  return Array.from(btns).map(b => ({
    text: b.textContent?.trim().slice(0, 30),
    active: b.classList.contains("active"),
    isParent: b.classList.contains("parent"),
  }));
});
console.log("nodes:", nodes);

// Get active key before
const beforeKey = await page.evaluate(() => {
  return document.querySelector(".node-btn.active")?.textContent?.trim();
});
console.log("active before:", beforeKey);

// Click 2nd leaf node
const leafIdxToClick = nodes.findIndex((n, i) => i > 0 && !n.isParent && !n.active);
console.log("clicking leaf idx:", leafIdxToClick, "text:", nodes[leafIdxToClick]?.text);
const buttons = await page.$$(".node-btn");
if (buttons[leafIdxToClick]) {
  await buttons[leafIdxToClick].click();
  await new Promise(r => setTimeout(r, 200));
}

// Check active after
const afterKey = await page.evaluate(() => {
  return document.querySelector(".node-btn.active")?.textContent?.trim();
});
console.log("active after:", afterKey);
console.log("changed:", beforeKey !== afterKey);

await browser.close();

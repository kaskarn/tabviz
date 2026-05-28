import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1100, height: 1400 });
await p.goto("http://localhost:4477/harness.html#v2-settings-scaffold", { waitUntil: "networkidle0" });

p.on("console", (m) => console.log("[browser]", m.text()));

await p.evaluate(() => {
  const btn = Array.from(document.querySelectorAll(".picker-btn")).find(b => b.textContent.trim() === "Layout");
  btn?.click();
});
await new Promise(r => setTimeout(r, 300));

// Find the FontFamily picker to confirm we're in Layout tab, then locate Flat card
const before = await p.evaluate(() => {
  // Read computed style of a chip in any other scenario
  const sw = document.querySelector(".swatch [style*='background']");
  return sw ? sw.getAttribute("style") : "no swatch";
});

await p.evaluate(() => {
  const cards = Array.from(document.querySelectorAll(".density-card"));
  const flat = cards.find(c => c.textContent.trim() === "Flat");
  if (!flat) { console.log("Flat not found"); return; }
  console.log("clicking flat");
  flat.click();
});
await new Promise(r => setTimeout(r, 500));

const after = await p.evaluate(() => {
  // Check active state
  const cards = Array.from(document.querySelectorAll(".density-card"));
  const active = cards.filter(c => c.classList.contains("active")).map(c => c.textContent.trim());
  // Click a swatch in Theme tab to see if spec is being mutated at all
  return { activeCards: active };
});

console.log(JSON.stringify({ before, after }, null, 2));
await b.close();

import puppeteer from "puppeteer";
const b = await puppeteer.launch({ headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1100, height: 1400 });
await p.goto("http://localhost:4477/harness.html#v2-settings-scaffold", { waitUntil: "networkidle0" });
await p.evaluate(() => {
  const btns = Array.from(document.querySelectorAll(".picker-btn"));
  btns.find((b) => b.textContent.trim() === "Marks")?.click();
});
await new Promise((r) => setTimeout(r, 300));
const info = await p.evaluate(() => {
  const summaries = Array.from(document.querySelectorAll(".head-summary"));
  return summaries.map((s) => ({
    html: s.innerHTML.slice(0, 200),
    cs: { display: getComputedStyle(s).display, width: s.getBoundingClientRect().width },
    children: Array.from(s.children).map(c => ({
      tag: c.tagName, cls: c.className, style: c.getAttribute("style"),
      bg: getComputedStyle(c).backgroundColor,
      w: c.getBoundingClientRect().width,
    })),
  })).slice(0, 3);
});
console.log(JSON.stringify(info, null, 2));
await b.close();

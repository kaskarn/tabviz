#!/usr/bin/env node
/**
 * Screenshot HTML widget files using Puppeteer
 *
 * Usage:
 *   node scripts/screenshot.js <input.html> [output.png] [--width=1200] [--height=800]
 *
 * Examples:
 *   node scripts/screenshot.js examples_output/basic.html
 *   node scripts/screenshot.js examples_output/basic.html screenshot.png --width=1600
 */

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Take a screenshot of an HTML file containing a tabviz widget
 */
async function screenshot(htmlPath, outputPath, options = {}) {
  const width = options.width || 1200;
  const height = options.height || 800;
  const scale = options.scale || 2;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: scale,
    });

    // Load the HTML file
    const absolutePath = path.resolve(htmlPath);
    await page.goto(`file://${absolutePath}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for the widget to render
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });

    // Small delay for any animations to complete
    await new Promise((r) => setTimeout(r, 500));

    // Screenshot just the widget element
    const element = await page.$(".tabviz-container");

    if (element) {
      await element.screenshot({
        path: outputPath,
        type: "png",
      });
      console.log(`Screenshot saved: ${outputPath}`);
    } else {
      // Fallback to full page screenshot
      await page.screenshot({
        path: outputPath,
        type: "png",
        fullPage: true,
      });
      console.log(`Full page screenshot saved: ${outputPath}`);
    }
  } finally {
    await browser.close();
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    width: 1200,
    height: 800,
    scale: 2,
  };

  const positional = [];

  for (const arg of args) {
    if (arg.startsWith("--width=")) {
      options.width = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--height=")) {
      options.height = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--scale=")) {
      options.scale = parseFloat(arg.split("=")[1]);
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  return { positional, options };
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: node screenshot.js <input.html> [output.png] [options]

Options:
  --width=N    Viewport width in pixels (default: 1200)
  --height=N   Viewport height in pixels (default: 800)
  --scale=N    Device scale factor (default: 2 for retina)

Examples:
  node screenshot.js gallery.html
  node screenshot.js gallery.html gallery.png --width=1600
  `);
  process.exit(0);
}

const { positional, options } = parseArgs(args);
const inputPath = positional[0];
const outputPath = positional[1] || inputPath.replace(/\.html$/i, ".png");

screenshot(inputPath, outputPath, options).catch((err) => {
  console.error("Screenshot failed:", err.message);
  process.exit(1);
});

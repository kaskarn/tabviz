#!/usr/bin/env node
/**
 * Production-posture gate for the built bundles.
 *
 * The theme system's failure policy is tiered: dev THROWS (CI surfaces
 * resolver bugs at the moment of introduction), production LOGS + DEGRADES
 * (one bad token must not take down a whole render). Both gates ask
 * `import.meta.env.PROD !== true`, which Vite inlines per bundle.
 *
 * WHAT THIS CATCHES (2026-07-28): declaring a SUB-KEY of `import.meta.env` in
 * a config's `define` (we set `SSR` to force client mode) makes Vite replace
 * the whole `import.meta.env` object with one built from the declared keys
 * only. `PROD` came back `undefined`, so `undefined !== true` folded to
 * `true` and EVERY shipped bundle believed it was a dev build — the check
 * minified to a literal `return !0` and the production degrade path was
 * unreachable. Any resolver throw then escaped: in the widget it landed
 * mid-Svelte-effect-flush and killed the reactive graph (figure AND settings
 * panel frozen until reload); in V8 it aborted the whole `save_plot`. A user
 * could brick the widget by dragging the Brand hue slider to its track end.
 *
 * WHY A POST-BUILD SCRIPT rather than a unit test: `npm test` runs BEFORE
 * `npm run build` in CI, and `inst/` bundles are committed — so a bun test
 * would assert against the STALE committed artifact and a config regression
 * would sail through. This must run after the build, next to check:size.
 * The matching source-level gates (every config spreads PROD_ENV_DEFINES; no
 * module re-derives the flag) live in `src/lib/theme/prod-degrade.test.ts`.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Bundles that must be built in production posture. */
const BUNDLES = [
  "inst/htmlwidgets/tabviz.js",
  "inst/htmlwidgets/tabviz_split.js",
  "inst/js/svg-generator.js",
  "inst/studio/studio.js",
];

/** esbuild folds a constant-TRUE dev check to this. Its presence means the
 *  bundle thinks it is a dev build. */
const ALWAYS_DEV = "try{return!0}catch{return!0}";
/** ...and a constant-FALSE one to this. Its presence is the positive proof
 *  that the flag was inlined at all (rather than the function being absent
 *  because a refactor renamed or dropped it — that would make the negative
 *  check above vacuously pass). */
const ALWAYS_PROD = "try{return!1}catch{return!0}";

let failed = false;
const width = Math.max(...BUNDLES.map((b) => b.length));

console.log("Production-posture gate — dev checks must fold to false");
console.log("─".repeat(72));

for (const rel of BUNDLES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log(`${rel.padEnd(width)}  MISSING   (run npm run build)`);
    failed = true;
    continue;
  }
  const src = fs.readFileSync(abs, "utf8");
  const devCount = src.split(ALWAYS_DEV).length - 1;
  const prodCount = src.split(ALWAYS_PROD).length - 1;

  if (devCount > 0) {
    console.log(
      `${rel.padEnd(width)}  FAIL      ${devCount} always-true dev check(s) — ` +
      `this bundle thinks it is a dev build`,
    );
    failed = true;
  } else if (prodCount === 0) {
    console.log(
      `${rel.padEnd(width)}  FAIL      no inlined dev check found — the flag ` +
      `is no longer being folded (renamed? dropped? define missing?)`,
    );
    failed = true;
  } else {
    console.log(`${rel.padEnd(width)}  OK        ${prodCount} dev check(s), all folded to false`);
  }
}

console.log("─".repeat(72));
if (failed) {
  console.error(
    "\nA bundle is not in production posture. Every vite config must spread\n" +
    "PROD_ENV_DEFINES (srcjs/vite.env-defines.ts) — see that file for why.",
  );
  process.exit(1);
}
console.log("All bundles built in production posture.");

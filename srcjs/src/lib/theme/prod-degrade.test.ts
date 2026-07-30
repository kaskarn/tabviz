// The theme system's failure policy is TIERED: under dev it THROWS (CI
// surfaces resolver bugs at the moment of introduction), in production it
// logs + degrades so one bad token can't take down the whole render. Both
// gates — `resolve-theme.ts::isDev` and `theme-css.ts::_isDevBuild` — decide
// via `import.meta.env.PROD !== true`, which Vite must inline per bundle.
//
// THE BUG THIS GUARDS (2026-07-28): declaring a SUB-KEY of `import.meta.env`
// in a config's `define` (we set `SSR` to force client mode) makes Vite
// substitute the whole `import.meta.env` object with one built from the
// declared keys only. `PROD` came back `undefined`, `undefined !== true`
// folded to `true`, and EVERY shipped bundle believed it was a dev build —
// both gates minified to a literal `return !0`. The production degrade path
// was unreachable in all four bundles, so any resolver throw escaped: in the
// widget it landed mid-Svelte-effect-flush and killed the reactive graph
// (figure AND settings panel frozen until reload); in V8 it aborted the
// whole save_plot. A user could brick the widget by dragging the Brand hue
// slider to the end of its track.
//
// This gate is source-level (always runs, unlike a built-artifact check that
// silently skips when nothing built it): every config that declares any
// `import.meta.env.*` key must route through the shared PROD_ENV_DEFINES.

import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import { PROD_ENV_DEFINES } from "../../../vite.env-defines";
import { isDevBuild } from "../build-env";

const ROOT = path.resolve(import.meta.dir, "../../..");
const PROD_CONFIGS = [
  "vite.config.ts",       // htmlwidget
  "vite.config.split.ts", // split forest widget
  "vite.config.v8.ts",    // R-side V8 export
  "vite.config.npm.ts",   // published @tabviz/core
  "vite.config.studio.ts", // inst/studio living tutorial (D36)
];

describe("PROD_ENV_DEFINES", () => {
  it("marks the build as production, not dev", () => {
    expect(PROD_ENV_DEFINES["import.meta.env.PROD"]).toBe("true");
    expect(PROD_ENV_DEFINES["import.meta.env.DEV"]).toBe("false");
  });

  it("still forces client-side mode (the define that started all this)", () => {
    expect(PROD_ENV_DEFINES["import.meta.env.SSR"]).toBe("false");
  });
});

describe("every production vite config routes through the shared defines", () => {
  for (const cfg of PROD_CONFIGS) {
    it(`${cfg} spreads PROD_ENV_DEFINES`, () => {
      const src = fs.readFileSync(path.join(ROOT, cfg), "utf8");
      expect(src).toContain("PROD_ENV_DEFINES");
      // An inline `import.meta.env.*` define alongside the spread would
      // re-open the exact hole (a later key can shadow the shared ones).
      const inline = src.match(/"import\.meta\.env\.\w+"\s*:/g) ?? [];
      expect(`${cfg}: ${inline.join(",")}`).toBe(`${cfg}: `);
    });
  }
});

describe("dev detection is single-sourced", () => {
  // Three modules used to answer "am I a dev build?" three different ways.
  // Two were byte-identical private copies (so ONE root cause had to be
  // diagnosed twice); the third read `process.env.NODE_ENV`, which is
  // undefined in BOTH the browser and V8 — its "skip in production" gate
  // never engaged in either, so the contrast validator (a second half-
  // cascade over every role) ran on every theme commit in the widget and
  // every buildTheme in the R-side export.
  const THEME_SRC = path.join(ROOT, "src/lib/theme");

  it("under a source-level runner we are a dev build (loud failures belong here)", () => {
    expect(isDevBuild()).toBe(true);
  });

  it("no module re-derives the PROD flag privately", () => {
    for (const f of fs.readdirSync(THEME_SRC).filter((n) => n.endsWith(".ts"))) {
      if (f.includes(".test.") || f.includes(".runes.")) continue;
      const src = fs.readFileSync(path.join(THEME_SRC, f), "utf8");
      // Comments legitimately name the flag; code must not read it.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(`${f}: ${code.includes("env?.PROD") || code.includes("env.PROD")}`).toBe(`${f}: false`);
    }
  });

  it("no module gates on NODE_ENV (undefined off Node — browser and V8)", () => {
    for (const f of fs.readdirSync(THEME_SRC).filter((n) => n.endsWith(".ts"))) {
      if (f.includes(".test.") || f.includes(".runes.")) continue;
      const src = fs.readFileSync(path.join(THEME_SRC, f), "utf8");
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(`${f}: ${code.includes("NODE_ENV")}`).toBe(`${f}: false`);
    }
  });
});

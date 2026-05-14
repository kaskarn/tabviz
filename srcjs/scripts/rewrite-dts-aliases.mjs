#!/usr/bin/env node
//
// rewrite-dts-aliases.mjs — post-process declaration files so the
// path aliases ($types, $stores/..., $lib/..., $spec/..., $export/...,
// $core/..., $svelte/...) become relative imports the npm consumer's
// TypeScript can resolve without our internal tsconfig `paths` map.
//
// Runs after `tsc -p tsconfig.npm.json`. The emitted .d.ts files live
// under `dist/<subdir>/...` mirroring the source tree, so every alias
// can be rewritten to a relative path computed from the file's own
// dist position.
//
// Aliases mirror the publisher tsconfig — keep this list in sync with
// `tsconfig.json::paths`.

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");

// Alias → real subdir under dist/. Sources of truth: tsconfig paths +
// vite aliases. Anything that maps to `src/<x>/` ends up at `dist/<x>/`.
const ALIASES = {
  $types: "types",
  $stores: "stores",
  $lib: "lib",
  $spec: "spec",
  $export: "export",
  $core: "core",
  $svelte: "svelte",
  $components: "components",
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".d.ts") || full.endsWith(".d.mts")) out.push(full);
  }
  return out;
}

function rewriteOne(file) {
  const src = readFileSync(file, "utf8");
  let out = src;
  const fileDir = path.dirname(file);

  // Rewrite every place a string is interpreted as a module specifier:
  //   * `from "$alias[/...]"`                — static + type import re-exports
  //   * `import("$alias[/...]")`             — dynamic-style type imports
  //   * `module "$alias[/...]"`              — ambient module declarations
  // The regex captures the alias body and optional suffix; we map the
  // alias root to its real dist subdir and compute a relative path from
  // the current file.
  out = out.replace(
    /(from\s+|import\(\s*|module\s+)(["'])\$([A-Za-z]+)(\/[^"']+)?\2/g,
    (whole, leading, quote, alias, suffix) => {
      const target = ALIASES[`$${alias}`];
      if (!target) return whole; // unknown alias — leave intact
      // $alias root form: tsconfig maps to `./src/<target>/index.ts`.
      // Suffix form: maps to `./src/<target>/<suffix>`.
      const distTarget = suffix
        ? path.join(DIST, target, suffix.slice(1))
        : path.join(DIST, target, "index");
      let rel = path.relative(fileDir, distTarget);
      if (!rel.startsWith(".")) rel = "./" + rel;
      return `${leading}${quote}${rel}${quote}`;
    },
  );

  if (out !== src) {
    writeFileSync(file, out, "utf8");
    return true;
  }
  return false;
}

const files = walk(DIST);
let rewritten = 0;
for (const f of files) {
  if (rewriteOne(f)) rewritten++;
}
console.log(
  `rewrite-dts-aliases: scanned ${files.length} files, rewrote ${rewritten}`,
);

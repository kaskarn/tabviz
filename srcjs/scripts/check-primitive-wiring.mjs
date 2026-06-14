#!/usr/bin/env node
/**
 * check-primitive-wiring.mjs
 *
 * CI gate. Every usage of a v2 value-bearing primitive (Knob / Swatch /
 * Picker / Pill / Slider / FontFamily / Toggle / Select / TabBar) must
 * either:
 *   - declare an `onchange=` attribute on the call site, OR
 *   - use `bind:value=` for two-way binding.
 *
 * Without one of those the primitive's internal mutations are lost — a
 * silent dead-wire bug. This was the cause of ~10 broken controls
 * across ColumnEditorV2 (Width Knob, slot Picker, schema option
 * Knobs/Swatches/Pickers, value-or-field mapped sub-controls) until
 * caught manually 2026-05-25.
 *
 * Fail-loud: each unwired call prints `file:line  <Primitive>  hint`
 * and the script exits non-zero.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Primitives that emit value changes via $bindable and/or onchange.
// Static/presentational primitives (Field, Section, Accordion, TabBar
// when used purely for navigation) are excluded — they have their own
// callback shapes (onclick, onreset, etc.) audited elsewhere.
const PRIMITIVES = [
  "Knob",
  "Swatch",
  "Picker",
  "Pill",
  "Slider",
  "FontFamily",
  "Toggle",
];

// Files that are themselves wrappers around the primitives (forward
// `onchange` via bind:value + $effect — the established pattern). They
// would trip the lint on their own internal usages, so they're skipped.
const WRAPPER_ALLOWLIST = new Set([
  "src/components/ui/TextField.svelte",
]);

const root = path.resolve(import.meta.dirname, "..");
const ROOT_RE = new RegExp(`${root}/`, "g");

const files = execSync(
  `git ls-files 'src/**/*.svelte'`,
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((f) => !WRAPPER_ALLOWLIST.has(f));

// Match an opening tag of any audited primitive. Captures the tag name
// + a chunk extending until the closing `>` or `/>` of that opening
// tag (which is the only place attributes can live).
const tagPattern = new RegExp(
  `<(${PRIMITIVES.join("|")})(\\s[^]*?)(/?>)`,
  "g",
);

const violations = [];

// Strip `<!-- ... -->` HTML comments and `/* ... */` JS-block comments
// so example syntax in docstrings doesn't trigger false positives.
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

for (const rel of files) {
  const abs = path.join(root, rel);
  const rawSrc = readFileSync(abs, "utf8");
  const src = stripComments(rawSrc);

  for (const m of src.matchAll(tagPattern)) {
    const [whole, tag, attrs] = m;
    const hasOnchange = /\sonchange\s*=/.test(attrs);
    const hasBind     = /\sbind:value\s*=/.test(attrs);
    // `oncommit=` is Slider's release-commit channel (settings-overhaul
    // P1): drag previews are optional; the commit wire is what matters.
    const hasCommit   = /\soncommit\s*=/.test(attrs);
    if (hasOnchange || hasBind || hasCommit) continue;

    // Skip Knob/Slider used purely for display (no value mutation
    // expected): heuristic — the call passes `disabled` or
    // `readonly`. Rare but legitimate; the explicit disable signals
    // intent.
    if (/\s(disabled|readonly)(\s*=\s*\{?\s*true\b|[^a-zA-Z0-9_])/.test(attrs)) {
      continue;
    }

    // Find line number of the match.
    const lineNo = src.slice(0, m.index).split("\n").length;
    violations.push({ file: rel, line: lineNo, tag });
  }
}

if (violations.length === 0) {
  process.stdout.write(`primitive-wiring: clean (${files.length} files audited)\n`);
  process.exit(0);
}

process.stderr.write(`primitive-wiring: ${violations.length} dead wire(s) detected:\n\n`);
for (const v of violations) {
  process.stderr.write(
    `  ${v.file}:${v.line}  <${v.tag}>  — missing 'onchange=' or 'bind:value='\n`,
  );
}
process.stderr.write(
  `\nAdd an explicit 'onchange={(v) => ...}' (preferred — matches Pill / Picker / Slider) or 'bind:value={...}'.\n`,
);
process.exit(1);

// Component-tokens drift gate (v4 substrate).
//
// Enforces the consumer contract declared in component-tokens.ts:
//
//   1. Every `--tv-*` reference in a consumer file (under
//      srcjs/src/{components,svelte,export,stores,lib,schema}) is either
//      declared in COMPONENT_TOKENS or grandfathered in KNOWN_UNCONSUMED.
//
//   2. Every entry in COMPONENT_TOKENS has at least one consumer file that
//      actually references its cssVar (unless grandfathered).
//
// During the substrate sprint (steps 1–6 of Stage 1 §40), KNOWN_UNCONSUMED
// starts at "all entries because no consumer migrated yet" and SHRINKS as
// consumer files switch from `theme.foo.bar` reads to `var(--tv-foo-bar)`.
// The shrink-only invariant (CLAUDE.md drift-gate discipline + Stage 1 §4b)
// is enforced by a CI guard checking entry count between commits.
//
// Mirrors the pattern from srcjs/src/schema/columns/drift.test.ts.
//
// Removing a token from KNOWN_UNCONSUMED:
//   1. Edit a consumer file in the token's `consumedBy` to read
//      `var(--tv-{cssVar-name-after-prefix})` somewhere in its source.
//   2. Delete the token's row from KNOWN_UNCONSUMED in component-tokens.ts.
//   3. Re-run this test; should pass with one fewer grandfathered entry.

import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { COMPONENT_TOKENS, KNOWN_UNCONSUMED } from "./component-tokens";

// Repo-relative path to srcjs/src.
const SRC_ROOT = join(import.meta.dir, "..", "..");

// Directories under srcjs/src/ to scan for consumer references.
const CONSUMER_DIRS = ["components", "svelte", "export", "stores", "lib", "schema"];

// File extensions to scan.
const EXTENSIONS = new Set([".ts", ".tsx", ".svelte", ".css"]);

// Match `--tv-*` CSS variable references in any file content.
const CSS_VAR_RE = /--tv-[a-z][a-z0-9-]*/g;

/** Recursively enumerate files under a directory, filtered by extension. */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      // Skip test files; their --tv-* references shouldn't drive the gate
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walkFiles(full));
    } else if (stat.isFile()) {
      // Exclude the manifest itself: its KNOWN_UNCONSUMED strings and
      // `cssVar:` declaration literals would self-match and make both the
      // entry-has-consumer check and the staleness check vacuous.
      if (entry === "component-tokens.ts") continue;
      const dot = entry.lastIndexOf(".");
      const ext = dot >= 0 ? entry.slice(dot) : "";
      if (EXTENSIONS.has(ext) && !entry.endsWith(".test.ts")) {
        out.push(full);
      }
    }
  }
  return out;
}

/** Collect every `--tv-*` reference across all consumer files.
 *  Returns Map<cssVar, Set<relativePath>>. */
function collectConsumerReferences(): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();
  for (const subdir of CONSUMER_DIRS) {
    const root = join(SRC_ROOT, subdir);
    const files = walkFiles(root);
    for (const file of files) {
      const rel = relative(SRC_ROOT, file);
      let content: string;
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const matches = content.match(CSS_VAR_RE);
      if (!matches) continue;
      for (const cssVar of matches) {
        if (!refs.has(cssVar)) refs.set(cssVar, new Set());
        refs.get(cssVar)!.add(rel);
      }
    }
  }
  return refs;
}

describe("component-tokens drift gate", () => {
  const refs = collectConsumerReferences();
  const declaredVars = new Set(COMPONENT_TOKENS.map((t) => t.cssVar));

  it("every consumer --tv-* reference is declared in COMPONENT_TOKENS (or grandfathered)", () => {
    const undeclared: Array<{ cssVar: string; files: string[] }> = [];
    for (const [cssVar, files] of refs) {
      if (declaredVars.has(cssVar)) continue;
      if (KNOWN_UNCONSUMED.has(cssVar)) continue;
      undeclared.push({ cssVar, files: [...files].sort() });
    }
    if (undeclared.length > 0) {
      const lines = undeclared
        .map(
          (u) =>
            `  ${u.cssVar}\n    referenced by: ${u.files.join(", ")}`,
        )
        .join("\n");
      throw new Error(
        `${undeclared.length} CSS variable(s) used by consumers but not declared in COMPONENT_TOKENS:\n${lines}\n\n` +
          `Either add the entry to COMPONENT_TOKENS in component-tokens.ts, ` +
          `or add the cssVar to KNOWN_UNCONSUMED (debt — only for in-flight migration).`,
      );
    }
    expect(undeclared.length).toBe(0);
  });

  it("every COMPONENT_TOKENS entry has at least one consumer reference (or is grandfathered)", () => {
    const unreferenced: string[] = [];
    for (const t of COMPONENT_TOKENS) {
      if (refs.has(t.cssVar)) continue;
      if (KNOWN_UNCONSUMED.has(t.cssVar)) continue;
      unreferenced.push(t.cssVar);
    }
    if (unreferenced.length > 0) {
      const lines = unreferenced.map((v) => `  ${v}`).join("\n");
      throw new Error(
        `${unreferenced.length} COMPONENT_TOKENS entry/entries declared but not referenced by any consumer:\n${lines}\n\n` +
          `Either remove the entry, ensure the declared consumedBy files actually reference it via var(--tv-...), ` +
          `or add the cssVar to KNOWN_UNCONSUMED.`,
      );
    }
    expect(unreferenced.length).toBe(0);
  });

  it("KNOWN_UNCONSUMED entries are not stale", () => {
    // A KNOWN_UNCONSUMED entry is justified by either:
    //   (A) The cssVar is in COMPONENT_TOKENS but no consumer references
    //       it yet (manifest entry awaiting consumer migration during
    //       step 6 of Stage 1 §40), or
    //   (B) The cssVar IS referenced by at least one consumer but isn't
    //       in COMPONENT_TOKENS (legacy v3 reference awaiting either
    //       migration to a new cssVar name or v3-emitter deletion in
    //       step 10 of Stage 1 §40).
    //
    // An entry is stale ONLY if neither condition holds — i.e., nothing
    // in the codebase references the cssVar AND it's not in the manifest.
    // Such an entry is dead weight and should be removed.
    const stale: string[] = [];
    for (const cssVar of KNOWN_UNCONSUMED) {
      const inManifest = declaredVars.has(cssVar);
      const referenced = refs.has(cssVar);
      if (!inManifest && !referenced) {
        stale.push(cssVar);
      }
    }
    if (stale.length > 0) {
      const lines = stale.map((v) => `  ${v}`).join("\n");
      throw new Error(
        `${stale.length} KNOWN_UNCONSUMED entry/entries are stale ` +
          `(not in COMPONENT_TOKENS AND not referenced by any consumer):\n${lines}\n\n` +
          `Remove these rows from KNOWN_UNCONSUMED.`,
      );
    }
    expect(stale.length).toBe(0);
  });
});

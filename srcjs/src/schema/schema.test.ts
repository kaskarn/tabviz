// Schema drift gate — assert the checked-in generated files match
// what the codegen would emit. Failure means someone changed the
// schema (or the emitter) without re-running
// `bun run scripts/regenerate-schema.ts`.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const here = import.meta.dir;
const repoRoot = resolve(here, "../../..");

function expectGeneratedFileUpToDate(relPath: string) {
  const checkedIn = readFileSync(resolve(repoRoot, relPath), "utf-8");
  // Re-run the codegen script into a temp dir, then diff. Cheaper: run
  // the actual script (it writes to the canonical paths), capture
  // current vs new. To avoid stomping the checked-in file during the
  // test run we read it first, run codegen, read again, then restore
  // if needed. Simpler: just snapshot-compare against what we'd write
  // if we re-ran now.
  const before = checkedIn;
  execSync(`bun run scripts/regenerate-schema.ts`, {
    cwd: resolve(repoRoot, "srcjs"),
    stdio: "pipe",
  });
  const after = readFileSync(resolve(repoRoot, relPath), "utf-8");
  // If `after` differs from `before`, the checked-in file was stale.
  // Either way, the test should leave the file matching the schema —
  // codegen already overwrote, so do NOT restore stale content.
  expect(after).toBe(before);
}

describe("schema drift gate", () => {
  test("srcjs/src/types/column-options.generated.ts is up to date", () => {
    expectGeneratedFileUpToDate("srcjs/src/types/column-options.generated.ts");
  });

  test("R/schema-defaults.R is up to date", () => {
    expectGeneratedFileUpToDate("R/schema-defaults.R");
  });
});

#!/usr/bin/env node
/**
 * link-htmlwidgets-dev.mjs
 *
 * Dev convenience: replace the installed package's `htmlwidgets/`
 * directory + `js/` directory with symlinks back to the source-tree
 * `inst/htmlwidgets/` + `inst/js/`. After this runs once,
 *
 *   cd srcjs && npm run build
 *
 * is enough to reload the bundle — no `devtools::install` round-trip.
 * The next R session that renders a tabviz widget picks up the freshly
 * built JS/CSS from the symlinked dir.
 *
 * Safety:
 * - Refuses to run if the installed dir is NOT under the user's
 *   R library (we don't want to clobber a system-wide tabviz install).
 * - Backs up the original directory to `<dir>.preserved-<timestamp>`
 *   on first run so a future `devtools::install` can restore by
 *   removing the symlink.
 *
 * Reverse with: `node scripts/link-htmlwidgets-dev.mjs --unlink`.
 *
 * Idempotent: re-runs are no-ops once the symlink is in place.
 */
import { execSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const unlinkMode = process.argv.includes("--unlink");

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const sourceHtmlwidgets = path.join(repoRoot, "inst/htmlwidgets");
const sourceJs          = path.join(repoRoot, "inst/js");
if (!existsSync(sourceHtmlwidgets)) {
  process.stderr.write(`source not found: ${sourceHtmlwidgets}\n`);
  process.exit(2);
}

// Discover installed package location via R.
const pkgPath = execSync(`Rscript -e 'cat(find.package("tabviz"))'`, { encoding: "utf8" })
  .trim();
if (!pkgPath) {
  process.stderr.write("could not locate installed tabviz package\n");
  process.exit(2);
}

// Safety: must be under the user's home (HOME or /opt/homebrew library).
const allowedPrefixes = [
  process.env.HOME,
  "/opt/homebrew/lib/R",
  "/usr/local/lib/R",
];
if (!allowedPrefixes.some((p) => p && pkgPath.startsWith(p))) {
  process.stderr.write(`refusing to touch ${pkgPath} — not under a known user library\n`);
  process.exit(2);
}

function relink(targetDir, sourceDir, label) {
  if (unlinkMode) {
    if (existsSync(targetDir) && lstatSync(targetDir).isSymbolicLink()) {
      rmSync(targetDir);
      process.stdout.write(`${label}: removed symlink → ${targetDir}\n`);
    }
    return;
  }

  // Already a symlink to the right place?
  if (existsSync(targetDir) && lstatSync(targetDir).isSymbolicLink()) {
    const current = readlinkSync(targetDir);
    if (current === sourceDir) {
      process.stdout.write(`${label}: already linked (no-op)\n`);
      return;
    }
    rmSync(targetDir);
  } else if (existsSync(targetDir)) {
    // Real directory — back it up so the next devtools::install can
    // overwrite (cp -R into the symlinked location works, but a backup
    // gives us an "undo" path if the symlinking turns out to be wrong).
    const backup = `${targetDir}.preserved-${Date.now()}`;
    renameSync(targetDir, backup);
    process.stdout.write(`${label}: backed up existing dir → ${backup}\n`);
  }

  symlinkSync(sourceDir, targetDir, "dir");
  process.stdout.write(`${label}: linked ${targetDir} → ${sourceDir}\n`);
}

relink(path.join(pkgPath, "htmlwidgets"), sourceHtmlwidgets, "htmlwidgets");
relink(path.join(pkgPath, "js"),          sourceJs,          "js");

if (unlinkMode) {
  process.stdout.write("unlinked — next `devtools::install()` will restore from package.\n");
} else {
  process.stdout.write(
    "\nLinked. `npm run build` now updates the installed widget bundle directly — no R install needed.\n" +
    "Reverse with: node scripts/link-htmlwidgets-dev.mjs --unlink\n",
  );
}

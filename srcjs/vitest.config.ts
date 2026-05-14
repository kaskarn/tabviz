import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

// Vitest config for tests that need Svelte 5 runes ($state, $derived, $effect).
// bun:test does NOT execute runes (it doesn't run the Svelte compiler), so any
// test that imports a *.svelte.ts module and instantiates code that uses runes
// must run under vitest, which goes through the Svelte plugin's compile step.
//
// Tests live alongside source as *.test.ts / *.test.svelte.ts; vitest's default
// glob picks them up.
//
// Phase 0c-PR2 introduced this config to unblock store-level tests (spec MFD-5).
// bun:test continues to handle pure-TS tests (proxy dispatch, event emitter,
// spec validator, formatters) via the `test` script; vitest handles the
// Svelte-context ones via `test:vitest`.

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, "src/lib"),
      $components: path.resolve(__dirname, "src/components"),
      $stores: path.resolve(__dirname, "src/stores"),
      $types: path.resolve(__dirname, "src/types"),
      $spec: path.resolve(__dirname, "src/spec"),
      $export: path.resolve(__dirname, "src/export"),
      $core: path.resolve(__dirname, "src/core"),
      $svelte: path.resolve(__dirname, "src/svelte"),
    },
    conditions: ["browser", "import", "module", "default"],
  },
  test: {
    // Default test pattern only picks up .svelte.test.ts so we don't double-run
    // the bun:test files that work fine under their own runner.
    include: ["src/**/*.svelte.test.ts"],
    environment: "jsdom",
    globals: false,
  },
});

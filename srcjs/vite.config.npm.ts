// vite.config.npm.ts — Build the npm publishable artifacts.
//
// Emits ESM bundles per subpath (core, svelte, export, spec) plus a
// shared style.css. The output lives under `dist/` so it doesn't
// collide with the R-side artifacts in `../inst/`. Phase 3 of the
// frontend-split program — see docs/dev/frontend-split-spec.md §3.10
// for the subpath shape this targets.
//
// The htmlwidgets bundles (tabviz.js, tabviz_split.js, svg-generator.js)
// stay on their own configs (vite.config.ts, vite.config.split.ts,
// vite.config.v8.ts) and ship vendored inside the R package's `inst/`.
// This file is for the npm consumer — typed factories, components,
// pure-function exporters — NOT IIFE.

import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte()],
  define: {
    "import.meta.env.SSR": "false",
  },
  build: {
    lib: {
      entry: {
        // Subpath → entry file. Each becomes `dist/<key>.mjs` per the
        // rollup `[name].mjs` template below.
        index: path.resolve(__dirname, "src/core/index.ts"),
        svelte: path.resolve(__dirname, "src/svelte/index.ts"),
        export: path.resolve(__dirname, "src/export/index.ts"),
        spec: path.resolve(__dirname, "src/spec/index.ts"),
      },
      formats: ["es"],
    },
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    ssr: false,
    rollupOptions: {
      // Don't bundle Svelte runtime or D3 — npm consumers bring their own.
      // They show up in `peerDependencies` of the published package.
      external: [
        "svelte",
        "svelte/internal",
        "svelte/internal/client",
        /^d3-/,
      ],
      output: {
        entryFileNames: "[name].mjs",
        chunkFileNames: "chunks/[name]-[hash].mjs",
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "style.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    minify: "esbuild",
    sourcemap: true,
  },
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
});

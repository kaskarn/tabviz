// Vite config for the component harness — builds a standalone
// browseable harness app at `tests/components/dist/harness.html`.
//
// Decoupled from the widget bundles: this config has its own root
// (`tests/components/`) so the harness page can be deployed (or
// puppeteered) without dragging the htmlwidget shim or split bundle
// along.

import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "tests/components"),
  // Relative base so the built harness.html works under file:// (puppeteer
  // driver loads it that way to avoid a dev-server dependency).
  base: "./",
  plugins: [svelte()],
  define: {
    "import.meta.env.SSR": "false",
  },
  build: {
    outDir: path.resolve(__dirname, "tests/components/dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "tests/components/harness.html"),
    },
    sourcemap: true,
    minify: false,
  },
  server: {
    port: 4477,
    strictPort: true,
  },
  resolve: {
    alias: {
      $lib:        path.resolve(__dirname, "src/lib"),
      $components: path.resolve(__dirname, "src/components"),
      $stores:     path.resolve(__dirname, "src/stores"),
      $types:      path.resolve(__dirname, "src/types"),
      $spec:       path.resolve(__dirname, "src/spec"),
      $export:     path.resolve(__dirname, "src/export"),
      $core:       path.resolve(__dirname, "src/core"),
      $svelte:     path.resolve(__dirname, "src/svelte"),
      $authoring:  path.resolve(__dirname, "src/authoring"),
      $schema:     path.resolve(__dirname, "src/schema"),
    },
    conditions: ["browser", "import", "module", "default"],
  },
});

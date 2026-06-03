import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

// Stage 3 — tabviz_studio bundle. Mounted inside a Shiny gadget served
// from inst/studio/. Auto-bootstraps from a #tabviz-studio-mount element
// reading data-initial-spec and data-initial-theme attributes.
export default defineConfig({
  plugins: [svelte()],
  define: {
    "import.meta.env.SSR": "false",
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/studio/index.ts"),
      name: "tabviz_studio",
      fileName: () => "studio.js",
      formats: ["iife"],
    },
    outDir: path.resolve(__dirname, "../inst/studio"),
    emptyOutDir: false,
    cssCodeSplit: false,
    ssr: false,
    rollupOptions: {
      output: {
        assetFileNames: "studio.[ext]",
        inlineDynamicImports: true,
      },
    },
    minify: "esbuild",
    sourcemap: false,
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
      $studio: path.resolve(__dirname, "src/studio"),
    },
    conditions: ["browser", "import", "module", "default"],
  },
});

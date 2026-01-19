import { defineConfig } from "vite";
import path from "path";

/**
 * Vite config for building the V8 bundle
 *
 * This creates a standalone IIFE bundle that can be loaded by the V8 R package.
 * It contains only the svg-generator and its dependencies, no Svelte or browser code.
 */
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/v8-entry.ts"),
      name: "tabvizV8",
      fileName: () => "svg-generator.js",
      formats: ["iife"],
    },
    outDir: path.resolve(__dirname, "../inst/js"),
    emptyOutDir: false,
    rollupOptions: {
      output: {
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
    },
  },
});

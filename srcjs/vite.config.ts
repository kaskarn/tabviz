import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import { PROD_ENV_DEFINES } from "./vite.env-defines";

export default defineConfig({
  plugins: [svelte()],
  define: { ...PROD_ENV_DEFINES },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/htmlwidgets/index.svelte.ts"),
      name: "tabviz",
      fileName: () => "tabviz.js",
      formats: ["iife"],
    },
    outDir: path.resolve(__dirname, "../inst/htmlwidgets"),
    emptyOutDir: false,
    cssCodeSplit: false,
    ssr: false,
    rollupOptions: {
      output: {
        assetFileNames: "tabviz.[ext]",
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
    },
    conditions: ["browser", "import", "module", "default"],
  },
});

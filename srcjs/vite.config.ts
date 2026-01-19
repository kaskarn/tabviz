import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte()],
  define: {
    // Force client-side mode (not SSR)
    "import.meta.env.SSR": "false",
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.svelte.ts"),
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
    },
    conditions: ["browser", "import", "module", "default"],
  },
});

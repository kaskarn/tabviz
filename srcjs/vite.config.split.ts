import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Build configuration for the split forest widget
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  define: {
    // Force client-side mode (not SSR)
    "import.meta.env.SSR": "false",
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index-split.svelte.ts"),
      name: "tabviz_split",
      fileName: () => "tabviz_split.js",
      formats: ["iife"],
    },
    outDir: path.resolve(__dirname, "../inst/htmlwidgets"),
    emptyOutDir: false,
    cssCodeSplit: false,
    ssr: false,
    rollupOptions: {
      output: {
        assetFileNames: "tabviz_split.[ext]",
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

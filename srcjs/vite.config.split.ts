import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

// Build configuration for the split forest widget. (No tailwindcss() plugin:
// there are zero @tailwind/@apply directives in src — it was vestigial config
// that diverged this target from vite.config.ts. The @tailwindcss/vite devDep
// can be dropped in a separate lockfile-parity-safe pass.)
export default defineConfig({
  plugins: [svelte()],
  define: {
    // Force client-side mode (not SSR)
    "import.meta.env.SSR": "false",
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/htmlwidgets/index-split.svelte.ts"),
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
      $spec: path.resolve(__dirname, "src/spec"),
      $export: path.resolve(__dirname, "src/export"),
      $core: path.resolve(__dirname, "src/core"),
      $svelte: path.resolve(__dirname, "src/svelte"),
    },
    conditions: ["browser", "import", "module", "default"],
  },
});

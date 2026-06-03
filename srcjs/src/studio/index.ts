// Stage 3 — Studio bundle entry point.
//
// Bootstraps the StudioShell from a mount element (#tabviz-studio-mount).
// The mount carries `data-initial-spec` and `data-initial-theme` as JSON
// strings; the shell reads them and initializes the studio store.

import { mount } from "svelte";
import StudioShell from "./StudioShell.svelte";

function bootstrap(): void {
  const el = document.getElementById("tabviz-studio-mount");
  if (!el) {
    console.warn("[tabviz_studio] mount element not found");
    return;
  }

  const initialSpecJson = el.getAttribute("data-initial-spec");
  const initialThemeJson = el.getAttribute("data-initial-theme");
  const initialSpec = initialSpecJson ? JSON.parse(initialSpecJson) : null;
  const initialTheme = initialThemeJson ? JSON.parse(initialThemeJson) : null;

  mount(StudioShell, {
    target: el,
    props: {
      initialSpec,
      initialTheme,
    },
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

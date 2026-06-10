// Stage 3 — Studio bundle entry point.
//
// Bootstraps the StudioShell from a mount element (#tabviz-studio-mount).
// The mount carries `data-initial-spec` and `data-initial-theme` as JSON
// strings; the shell reads them and initializes the studio store.
//
// When mounted in a static page (no Shiny host), data-initial-spec /
// data-initial-theme may be omitted; the bootstrap synthesizes a
// sample spec + the cochrane preset so the studio runs as a forge.

import { mount } from "svelte";
// Side-effect: register schema behaviors + DOM cell renderers BEFORE the
// studio preview mounts. Without this the interval/viz columns render
// BLANK in the forge — the renderer registry is empty (caught by the
// 2026-06-05 docs screenshot pass; the per-bundle side-effect-import trap
// from feedback_vite_side_effects, in unimported form).
import "../schema/init-dom";
// V4 canonical paint surface (wire-audit Pass 1a / B13): the studio's
// embedded TabvizPlot preview needs the same shell/paper/texture rules
// the widget bundle ships. Bundles into studio.css.
import "../lib/theme/theme-runtime.css";
import StudioShell from "./StudioShell.svelte";
import { tabviz } from "../authoring/tabviz";
import { colText, colN, colInterval } from "../authoring/columns";
import { vizForest } from "../authoring/viz";
import { themeNejm } from "../lib/theme/theme-api";

function buildSampleSpec(): unknown {
  // 8-row meta-analysis - representative chart for the studio to render.
  const rows = [
    { study: "Alpha 2024",   region: "Americas", n: 245, hr: 0.72, lo: 0.58, hi: 0.89 },
    { study: "Beta 2023",    region: "Americas", n: 189, hr: 0.81, lo: 0.65, hi: 1.01 },
    { study: "Gamma 2022",   region: "Europe",   n: 312, hr: 0.66, lo: 0.50, hi: 0.86 },
    { study: "Delta 2021",   region: "Europe",   n: 278, hr: 0.74, lo: 0.59, hi: 0.93 },
    { study: "Epsilon 2024", region: "Asia",     n: 478, hr: 0.91, lo: 0.78, hi: 1.06 },
    { study: "Zeta 2023",    region: "Asia",     n: 156, hr: 0.65, lo: 0.49, hi: 0.85 },
    { study: "Eta 2022",     region: "Africa",   n: 134, hr: 0.79, lo: 0.62, hi: 1.01 },
    { study: "Theta 2025",   region: "Oceania",  n: 412, hr: 0.83, lo: 0.69, hi: 0.99 },
  ];
  const theme = themeNejm();
  return tabviz({
    data: rows,
    label: "study",
    columns: [
      colText({ field: "region", header: "Region" }),
      colN({ field: "n", header: "N" }),
      colInterval({ point: "hr", lower: "lo", upper: "hi", header: "HR (95% CI)" }),
      vizForest({ point: "hr", lower: "lo", upper: "hi", axisLabel: "Hazard ratio" }),
    ],
    theme,
    title: "tabviz studio — quick forge",
    subtitle: "Edit any input; copy the R code; paste into your script.",
  });
}

function bootstrap(): void {
  const el = document.getElementById("tabviz-studio-mount");
  if (!el) {
    console.warn("[tabviz_studio] mount element not found");
    return;
  }

  try {
    const initialSpecJson = el.getAttribute("data-initial-spec");
    const initialThemeJson = el.getAttribute("data-initial-theme");

    let initialSpec: unknown;
    let initialTheme: unknown;

    if (initialSpecJson && initialThemeJson) {
      // Shiny / gadget mode — host supplied initial state.
      initialSpec = JSON.parse(initialSpecJson);
      initialTheme = JSON.parse(initialThemeJson);
    } else {
      // Static / forge mode — synthesize a sample spec + nejm theme.
      initialSpec = buildSampleSpec();
      initialTheme = themeNejm();
    }

    // Clear any docs-side fallback ("Loading studio…") before mounting.
    el.replaceChildren();

    mount(StudioShell, {
      target: el,
      props: {
        initialSpec,
        initialTheme,
      },
    });
  } catch (err) {
    console.error("[tabviz_studio] bootstrap failed:", err);
    el.innerHTML = `<pre style="padding:24px;font:13px ui-monospace,monospace;color:#b00;white-space:pre-wrap;">tabviz Studio failed to start:\n\n${String(err)}</pre>`;
  }
}

function isBenignError(err: unknown): boolean {
  // ResizeObserver "loop limit exceeded" / "loop completed with undelivered
  // notifications" is fired by Chromium when an observed element resizes
  // inside its own callback — common in nested layout libs and harmless.
  // We silence it specifically so the fatal-error trap doesn't fire.
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /ResizeObserver loop/i.test(msg);
}

function showFatal(err: unknown): void {
  if (isBenignError(err)) {
    console.debug("[tabviz_studio] benign:", err);
    return;
  }
  // Surface top-level / pre-bootstrap failures into the page so a static
  // viewer can see what broke without DevTools.
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  const el = document.getElementById("tabviz-studio-mount");
  if (el) {
    el.innerHTML = `<pre style="padding:24px;font:12.5px ui-monospace,monospace;color:#b00;white-space:pre-wrap;">tabviz Studio failed to start:\n\n${msg}</pre>`;
  }
  console.error("[tabviz_studio] fatal:", err);
}

// Trap any pre-bootstrap top-level errors (e.g. from a runaway module
// initializer) and any sync error inside bootstrap so the user sees it.
window.addEventListener("error", (ev) => showFatal(ev.error ?? ev.message));
window.addEventListener("unhandledrejection", (ev) => showFatal(ev.reason));

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
} catch (err) {
  showFatal(err);
}

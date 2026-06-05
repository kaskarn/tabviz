// DOM cell renderer for the `pictogram` schema — BROWSER-ONLY MODULE
// (imports CellPictogram.svelte; booted from init-dom).
//
// The SVG half lives in pictogram-svg-renderer.ts (V8-safe, booted from
// init.ts for both runtimes) — it was trapped in this module until the
// adversarial review found pictogram-family cells exporting as bare
// numbers because the V8 bundle could never load a Svelte import.
// registerRenderers merges per-target, so the two modules compose.

import type { RenderComponent, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import CellPictogram from "../../components/table/CellPictogram.svelte";
import { registerPictogramSvgRenderer } from "./pictogram-svg-renderer";

const pictogramDomRenderer: CellFormatter = (value, options, ctx) => {
  // Multi-field read: glyphSelector comes from the configured
  // glyph_field, when the glyph option is a value→glyph map.
  const opts = options as { pictogram?: { glyphField?: string } } | undefined;
  const glyphField = opts?.pictogram?.glyphField;
  const meta = (ctx?.row ?? {}) as Record<string, unknown>;
  const glyphSelector = glyphField ? (meta[glyphField] as string | number | null | undefined) ?? null : null;

  const node: RenderComponent = {
    kind: "component",
    name: "CellPictogram",
    props: {
      value: value as number | string | null | undefined,
      options: (opts?.pictogram ?? {}),
      naText: ctx?.naText ?? undefined,
      cellStyle: ctx?.cellStyle,
      colorOverride: ctx?.colorOverride ?? null,
      glyphSelector,
    },
  };
  return node;
};

/** Idempotent re-register helper. */
export function registerPictogramRenderer(): void {
  // Register the cell component first so the dom renderer's
  // RenderComponent node resolves to a mountable target.
  registerCellComponent("CellPictogram", CellPictogram as never);

  registerRenderers("pictogram", { dom: pictogramDomRenderer });
  // The svg half registers itself on import; re-call for test resets.
  registerPictogramSvgRenderer();
}

// Side-effect: register on first import.
registerPictogramRenderer();

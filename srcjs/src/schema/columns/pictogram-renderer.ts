// Cell renderer for the `pictogram` schema.
//
// Phase 7e *visual-cell* exemplar: the two runtimes target different
// DOM models, so the renderer pair diverges.
//
// - `dom`: returns a `RenderComponent` node pointing at
//   `CellPictogram.svelte`. The browser mounter looks the name up in
//   the cell-component registry and instantiates the component with
//   its existing prop surface — preserving scoped CSS, reactive
//   props, transitions. No SVG-markup-as-html step in the browser.
//
// - `svg`: NOT registered in this commit. The existing
//   `svg-generator.ts` pictogram branch (~180 LOC of inline markup
//   generation, deeply entangled with theme/row context) keeps
//   ownership of SVG export for pictogram cells until a follow-on
//   commit factors that block into a reusable pure function. The
//   schema's `svg` renderer registers at that point. Until then,
//   `renderCell(col, ..., "svg")` returns null for pictogram and
//   svg-generator falls through to its in-place path.

import type { RenderComponent, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import CellPictogram from "../../components/table/CellPictogram.svelte";

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
      // `naText`, `cellStyle`, `colorOverride` are passed by the
      // TabvizPlot caller through `ctx` extensions when 7e.4 wires
      // the consumer. For now these stay undefined; the component
      // already handles that gracefully.
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

  registerRenderers("pictogram", {
    dom: pictogramDomRenderer,
    // svg: deferred — see header comment.
  });
}

// Side-effect: register on first import.
registerPictogramRenderer();

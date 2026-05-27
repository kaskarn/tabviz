// Public extension API for tabviz schemas — third-party entry point.
//
// Consumers import from `@tabviz/core/extend` to add new column types,
// register renderers, attach lifecycle hooks, or read the registry:
//
//   import {
//     defineSchema, registerColumnType, compose, tag, text,
//   } from "@tabviz/core/extend";
//
//   const FANCY_RING = defineSchema({
//     key: "fancy_ring",
//     label: "Fancy Ring",
//     inherits: ["ring"],
//     options: [{ key: "innerRadius", control: "number", default: 0.5 }],
//   });
//
//   registerColumnType({
//     schema: FANCY_RING,
//     renderer: (val, opts, ctx, parents) => {
//       const ringSvg = parents.ring(val, opts, ctx);
//       const labelString = parents.percent(val, opts, ctx);
//       return compose(
//         tag(ringSvg, ["fancy-ring-glyph"]),
//         tag(text(String(labelString)), ["fancy-ring-label", "minor"]),
//         { sep: "" },
//       );
//     },
//   });
//
// This module is a thin re-export shell — implementations live under
// `src/schema/`. The `./extend` subpath in package.json points here.

// ── Registry + factory helpers ──────────────────────────────────────
export {
  defineSchema,
  registerSchema,
  registerRenderer,
  registerRenderers,
  registerLifecycle,
  registerBehaviors,
  registerColumnType,
  getSchema,
  getRenderer,
  getLifecycle,
  getBehaviors,
  allSchemaKeys,
  __resetRuntimeRegistries,
} from "../schema/extend";
export type { RenderTarget } from "../schema/extend";

// ── RenderNode tree builders ────────────────────────────────────────
export { compose, text } from "../schema/compose";
export { tag, textTagged } from "../schema/theme-finalize";

// ── Schema declaration types ────────────────────────────────────────
export type {
  ColumnSchema,
  OptionSpec,
  ControlKind,
  OptionKind,
  VariantSpec,
  WireAt,
  SchemaRegistry,
} from "../schema/types";

// ── Renderer + behavior + lifecycle types ───────────────────────────
export type {
  // Tree
  RenderNode,
  RenderText,
  RenderGroup,
  RenderSvg,
  RenderSpacer,
  RenderImage,
  RenderComponent,
  TextStyle,
  GroupStyle,
  ComposeOptions,
  // Renderer
  CellFormatter,
  RenderContext,
  ParentRenderers,
  SchemaRenderers,
  // Behaviors
  SchemaBehaviors,
  BehaviorContext,
  ParentBehaviors,
  SortableValue,
  // Lifecycle
  SchemaLifecycle,
  WidgetContext,
  SvgStream,
  Cleanup,
  // Bundled registration
  RegisterSpec,
} from "../schema/render-types";

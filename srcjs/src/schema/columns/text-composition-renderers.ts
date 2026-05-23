// Text-composition cell renderers — schemas whose cell output is a
// single formatted string (text, numeric, percent via numeric,
// events). Each renderer returns one `RenderText` node; both dom and
// svg slots get the same function because text is naturally
// runtime-agnostic.
//
// CellContent (the cellStyle-aware wrapper) is applied by the
// TabvizPlot consumer when it sees a non-component tree shape.

import type { Row } from "../../types";
import type { RenderText, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { formatNumber, formatEvents, truncateString } from "../../lib/formatters";

function text(value: string): RenderText {
  return { kind: "text", value };
}

// ────────────────────────────────────────────────────────────────────
// text — pure text with optional maxChars truncation
// ────────────────────────────────────────────────────────────────────

const textRenderer: CellFormatter = (value, options) => {
  const opts = options as { text?: { maxChars?: number | null }; naText?: string } | undefined;
  const raw = String(value ?? "");
  if (raw === "") return text(opts?.naText ?? "");
  const maxChars = opts?.text?.maxChars ?? null;
  return text(maxChars ? truncateString(raw, maxChars) : raw);
};

// ────────────────────────────────────────────────────────────────────
// numeric — formatNumber handles decimals/digits/abbr/prefix/suffix
//
// Note: numeric is also the resolution target for the `percent`,
// `currency`, and `n` schemas (all share wire type "numeric"). They
// all reach this renderer via inheritance chain dispatch, and
// `formatNumber` already does the right thing because it reads
// options.percent / options.numeric uniformly.
// ────────────────────────────────────────────────────────────────────

const numericRenderer: CellFormatter = (value, options) => {
  const opts = options as { naText?: string } | undefined;
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) {
    return text(opts?.naText ?? "");
  }
  return text(formatNumber(value as number, options as never));
};

// ────────────────────────────────────────────────────────────────────
// events — "N events / N total (xx.x%)" composite
// ────────────────────────────────────────────────────────────────────

const eventsRenderer: CellFormatter = (_value, options, ctx) => {
  const opts = options as { events?: unknown; naText?: string } | undefined;
  if (!opts?.events) return text(opts?.naText ?? "");
  // formatEvents reads from row.metadata via the configured field names.
  const fakeRow: Row = {
    id: "_",
    label: "",
    metadata: (ctx?.row ?? {}) as Record<string, unknown>,
  } as Row;
  return text(formatEvents(fakeRow, options as never));
};

/** Idempotent re-register helper for tests after registry reset. */
export function registerTextCompositionRenderers(): void {
  registerRenderers("text",    { dom: textRenderer,    svg: textRenderer });
  registerRenderers("numeric", { dom: numericRenderer, svg: numericRenderer });
  registerRenderers("events",  { dom: eventsRenderer,  svg: eventsRenderer });
}

// Side-effect: register on first import.
registerTextCompositionRenderers();

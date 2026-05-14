// Data slice — viewer-level "what we're rendering" state that doesn't
// belong on any of the column/row/edit slices.
//
// Owns:
//   - currentPage / continuousMode             — pagination cursor
//   - bandingOverride / bandingStartsWithBandOverride — runtime banding flip
//   - settingsOpen                             — settings panel visibility
//   - targetAspect                             — pinned aspect ratio
//
// Plus the pagination + banding $derived chain (totalPages, isPaginated,
// currentPageRowIds, paginatedRows, displayRows, effectiveBanding,
// bandingStartsWithBand) and the small action surface above each one.
//
// Watermark methods (setWatermark / previewWatermark / setWatermarkColor /
// setWatermarkOpacity) also live here — they're spec-level mutations that
// fired from the same UI panel as the banding controls and don't fit on
// any of the leaf-shape slices.
//
// Cross-slice deps:
//   - getSpec / setSpec        — read & rewrite the WebSpec (watermark,
//                                aspect anchor live in the spec proper)
//   - getFullDisplayRows       — rows-groups slice; pagination decides
//                                which display rows to show on the page
//   - appendOp / markSource    — history + source-tag plumbing
//
// Phase 0c-C1 PR10.

import type {
  BandingSpec,
  DisplayRow,
  WebSpec,
} from "$types";
import { parseBandingString } from "$lib/banding";
import { ops, type OpRecord } from "$lib/op-recorder";

const TARGET_ASPECT_MIN = 0.1;
const TARGET_ASPECT_MAX = 10;

export interface DataSliceDeps {
  getSpec: () => WebSpec | null;
  setSpec: (next: WebSpec) => void;
  getFullDisplayRows: () => readonly DisplayRow[];
  appendOp: (record: OpRecord) => void;
  markSource: (field: string) => void;
}

export interface DataSlice {
  readonly currentPage: number;
  readonly continuousMode: boolean;
  readonly totalPages: number;
  readonly isPaginated: boolean;
  readonly currentPageRowIds: ReadonlySet<string>;
  readonly paginatedRows: readonly DisplayRow[];
  readonly displayRows: readonly DisplayRow[];

  readonly bandingOverride: BandingSpec | null;
  readonly bandingStartsWithBandOverride: boolean | null;
  readonly effectiveBanding: BandingSpec;
  readonly bandingStartsWithBand: boolean;

  readonly settingsOpen: boolean;
  readonly targetAspect: number | null;

  setCurrentPage: (p: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setContinuousMode: (v: boolean) => void;

  setBandingOverride: (value: string | BandingSpec | null) => void;
  setBandingStartsWithBand: (value: boolean | null) => void;

  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;

  setTargetAspect: (ratio: number | null) => void;
  getTargetAspect: () => number | null;
  setTargetAspectAnchor: (anchor: "width" | "height" | "auto") => void;

  setWatermark: (value: string) => void;
  previewWatermark: (value: string) => void;
  setWatermarkColor: (value: string | null) => void;
  setWatermarkOpacity: (value: number) => void;

  /** Spec-swap hydrate. Resets currentPage to 1 (continuousMode stays as a
   *  viewer preference) and seeds targetAspect from the new spec. */
  hydrateForSpec: (newSpec: WebSpec) => void;
  /** Full wipe (used by resetState). Clears the banding overrides and
   *  resets pagination; leaves settingsOpen + the spec-derived targetAspect
   *  alone (resetState may fire from inside the settings panel itself). */
  reset: () => void;
}

export function createDataSlice(deps: DataSliceDeps): DataSlice {
  let currentPage = $state<number>(1);
  let continuousMode = $state<boolean>(false);
  let bandingOverride = $state<BandingSpec | null>(null);
  let bandingStartsWithBandOverride = $state<boolean | null>(null);
  let settingsOpen = $state<boolean>(false);
  let targetAspect = $state<number | null>(null);

  // ── Pagination derived ─────────────────────────────────────────────────

  const totalPages = $derived(deps.getSpec()?.paginate?.nPages ?? 0);
  const isPaginated = $derived(totalPages > 0 && !continuousMode);

  const currentPageRowIds = $derived.by((): Set<string> => {
    const spec = deps.getSpec();
    if (!spec?.paginate || continuousMode) return new Set();
    const page = spec.paginate.pages[currentPage - 1];
    if (!page) return new Set();
    const ids = new Set<string>();
    const rows = spec.data.rows;
    for (let i = page.startIdx; i <= page.endIdx && i < rows.length; i++) {
      ids.add(rows[i].id);
    }
    return ids;
  });

  const paginatedRows = $derived.by((): DisplayRow[] => {
    const fullDisplayRows = deps.getFullDisplayRows();
    if (!isPaginated) return [...fullDisplayRows];
    const rowIds = currentPageRowIds;
    if (rowIds.size === 0) return [];

    const include = new Array(fullDisplayRows.length).fill(false);
    for (let i = 0; i < fullDisplayRows.length; i++) {
      const dr = fullDisplayRows[i];
      if (dr.type === "data" && rowIds.has(dr.row.id)) include[i] = true;
    }
    // A group_header is included iff at least one descendant displayRow
    // (until a sibling/ancestor group_header at depth <= myDepth) is in.
    for (let i = 0; i < fullDisplayRows.length; i++) {
      const dr = fullDisplayRows[i];
      if (dr.type !== "group_header") continue;
      const myDepth = dr.depth;
      for (let j = i + 1; j < fullDisplayRows.length; j++) {
        const dj = fullDisplayRows[j];
        if (dj.type === "group_header" && dj.depth <= myDepth) break;
        if (include[j]) {
          include[i] = true;
          break;
        }
      }
    }
    const out: DisplayRow[] = [];
    for (let i = 0; i < fullDisplayRows.length; i++) {
      if (include[i]) out.push(fullDisplayRows[i]);
    }
    return out;
  });

  const displayRows = $derived.by((): readonly DisplayRow[] =>
    isPaginated ? paginatedRows : deps.getFullDisplayRows(),
  );

  function setCurrentPage(p: number) {
    if (totalPages === 0) {
      currentPage = 1;
      return;
    }
    currentPage = Math.max(1, Math.min(totalPages, Math.floor(p)));
  }

  function nextPage() {
    if (currentPage < totalPages) currentPage += 1;
  }

  function prevPage() {
    if (currentPage > 1) currentPage -= 1;
  }

  function setContinuousMode(v: boolean) {
    continuousMode = v;
  }

  // ── Banding derived + actions ──────────────────────────────────────────

  const effectiveBanding = $derived.by((): BandingSpec => {
    if (bandingOverride) return bandingOverride;
    const themeBanding = deps.getSpec()?.theme?.layout?.banding;
    if (themeBanding && typeof themeBanding === "object" && "mode" in themeBanding) {
      return themeBanding as BandingSpec;
    }
    return { mode: "group", level: null };
  });

  const bandingStartsWithBand = $derived.by((): boolean => {
    if (bandingStartsWithBandOverride !== null) return bandingStartsWithBandOverride;
    return effectiveBanding.mode === "group";
  });

  function setBandingOverride(value: string | BandingSpec | null) {
    if (value == null) {
      bandingOverride = null;
    } else if (typeof value === "string") {
      bandingOverride = parseBandingString(value);
    } else {
      bandingOverride = value;
    }
    deps.markSource("banding");
  }

  function setBandingStartsWithBand(value: boolean | null) {
    bandingStartsWithBandOverride = value;
    deps.markSource("banding");
  }

  // ── Settings panel ─────────────────────────────────────────────────────

  function openSettings()   { settingsOpen = true; }
  function closeSettings()  { settingsOpen = false; }
  function toggleSettings() { settingsOpen = !settingsOpen; }

  // ── Target aspect ──────────────────────────────────────────────────────

  function setTargetAspect(ratio: number | null): void {
    if (ratio != null && !Number.isFinite(ratio)) return;
    if (ratio != null && ratio <= 0) return;
    const clamped = ratio == null
      ? null
      : Math.max(TARGET_ASPECT_MIN, Math.min(TARGET_ASPECT_MAX, ratio));
    if (targetAspect === clamped) return;
    targetAspect = clamped;
    deps.appendOp(ops.setAspectRatio(clamped));
  }

  function getTargetAspect(): number | null {
    return targetAspect;
  }

  function setTargetAspectAnchor(anchor: "width" | "height" | "auto"): void {
    const spec = deps.getSpec();
    if (!spec) return;
    const current = spec.targetAspectAnchor ?? "width";
    if (current === anchor) return;
    deps.setSpec({ ...spec, targetAspectAnchor: anchor });
    if (targetAspect != null) {
      deps.appendOp(ops.setAspectRatio(targetAspect, anchor));
    }
  }

  // ── Watermark mutations (write through to spec) ────────────────────────

  function setWatermark(value: string) {
    const spec = deps.getSpec();
    if (!spec) return;
    deps.setSpec({ ...spec, watermark: value });
    // Empty string clears the watermark — emit NULL so View Source reads
    // `set_watermark(NULL)`, not `set_watermark("")`.
    const text = value === "" ? null : value;
    deps.appendOp(ops.setWatermark(text));
  }

  function previewWatermark(value: string) {
    const spec = deps.getSpec();
    if (!spec) return;
    deps.setSpec({ ...spec, watermark: value });
  }

  function setWatermarkColor(value: string | null) {
    const spec = deps.getSpec();
    if (!spec) return;
    deps.setSpec({ ...spec, watermarkColor: value ?? undefined });
  }

  function setWatermarkOpacity(value: number) {
    const spec = deps.getSpec();
    if (!spec) return;
    const clamped = Math.max(0, Math.min(1, value));
    deps.setSpec({ ...spec, watermarkOpacity: clamped });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  function hydrateForSpec(newSpec: WebSpec) {
    // Pagination resets to page 1 with each spec swap (split-by navigation
    // flows through setSpec, and "the same page index across different
    // data" would point at unrelated rows). Continuous-mode toggle is
    // preserved as a viewing preference.
    currentPage = 1;
    // Seed the aspect-ratio target from the spec (set R-side by
    // `set_aspect_ratio()` or by the `target_aspect` field). null/undefined
    // means "render at natural"; the slider sits at the natural detent.
    const rawTarget = newSpec.targetAspect;
    targetAspect = (typeof rawTarget === "number" && rawTarget > 0)
      ? rawTarget
      : null;
  }

  function reset() {
    bandingOverride = null;
    bandingStartsWithBandOverride = null;
    // currentPage left alone (resetState doesn't reset pagination cursor —
    // matches the pre-extraction behavior).
  }

  return {
    get currentPage()                   { return currentPage; },
    get continuousMode()                { return continuousMode; },
    get totalPages()                    { return totalPages; },
    get isPaginated()                   { return isPaginated; },
    get currentPageRowIds()             { return currentPageRowIds; },
    get paginatedRows()                 { return paginatedRows; },
    get displayRows()                   { return displayRows; },

    get bandingOverride()               { return bandingOverride; },
    get bandingStartsWithBandOverride() { return bandingStartsWithBandOverride; },
    get effectiveBanding()              { return effectiveBanding; },
    get bandingStartsWithBand()         { return bandingStartsWithBand; },

    get settingsOpen()                  { return settingsOpen; },
    get targetAspect()                  { return targetAspect; },

    setCurrentPage, nextPage, prevPage, setContinuousMode,
    setBandingOverride, setBandingStartsWithBand,
    openSettings, closeSettings, toggleSettings,
    setTargetAspect, getTargetAspect, setTargetAspectAnchor,
    setWatermark, previewWatermark, setWatermarkColor, setWatermarkOpacity,
    hydrateForSpec, reset,
  };
}

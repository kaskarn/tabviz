// COMPILE-TIME gate: hand-written `*ColumnOptions` types (types/index.ts, what
// the DOM cells import) must not reference any option KEY absent from the
// schema-generated `*BucketOptions` (column-options.generated.ts, derived from
// the SCHEMA_REGISTRY — the source of truth for what the wire carries).
//
// This is the structural fix for the dead-key class: the stars bug
// (`maxStars`/`halfStars` on the hand-written type — names the wire never
// carries; the schema/wire uses `maxGlyphs`/`halfGlyphs`) was invisible because
// the two type families drifted independently. Here each hand-written type's
// keys MINUS the generated type's keys must be `never`. The generated type may
// have MORE keys (inherited schema options, e.g. stars inherits pictogram's
// glyph/layout/…) — the hand-written is a curated subset, so only the
// hand-written→generated direction is checked.
//
// A violation surfaces as a tsc/svelte-check error ON THE OFFENDING LINE
// ("Type 'X' does not satisfy the constraint 'never'") — naming the exact
// drifted key + pair. No runtime; enforced by `npm run check`.
//
// Scope: the PURE-OPTION column types only. Excluded:
//   - events/viz (no generated BucketOptions) and custom/date (no hand-written
//     ColumnOptions) — no pair to compare.
//   - forest/interval/range/vizBar/vizBoxplot/vizViolin — their hand-written
//     `*ColumnOptions` deliberately CONFLATE data fields (point/lower/upper/
//     minField), the `type` discriminator, and internal computed keys
//     (__resolved) with options, so they're not a subset of the pure-OPTION
//     generated `*BucketOptions`. (That field-vs-option conflation is its own
//     design smell — a separate follow-up; not a dead-key bug.)
// The 15 below ARE pure-option, so the subset invariant is valid + catches the
// dead-key class (the stars maxStars/maxGlyphs bug).

import type {
  BadgeColumnOptions, BarColumnOptions, HeatmapColumnOptions,
  IconColumnOptions, ImgColumnOptions, NumericColumnOptions,
  PercentColumnOptions, PictogramColumnOptions, ProgressColumnOptions, PvalueColumnOptions,
  ReferenceColumnOptions, RingColumnOptions, SparklineColumnOptions,
  StarsColumnOptions, TextColumnOptions,
} from "./index";
import type {
  BadgeBucketOptions, BarBucketOptions, HeatmapBucketOptions,
  IconBucketOptions, ImgBucketOptions, NumericBucketOptions,
  PercentBucketOptions, PictogramBucketOptions, ProgressBucketOptions, PvalueBucketOptions,
  ReferenceBucketOptions, RingBucketOptions, SparklineBucketOptions,
  StarsBucketOptions, TextBucketOptions,
} from "./column-options.generated";

/** Keys present on the hand-written type but ABSENT from the schema-generated
 *  one — must be `never`. */
type ExtraKeys<HandWritten, Generated> = Exclude<keyof HandWritten, keyof Generated>;
/** Fails to compile when `T` is not `never` (i.e. a hand-written type declares
 *  an option the schema doesn't). The offending KEY appears in the error. */
type AssertNoExtraKeys<T extends never> = T;

// One per mappable pair — exported so they count as "used".
export type _Parity_Badge      = AssertNoExtraKeys<ExtraKeys<BadgeColumnOptions, BadgeBucketOptions>>;
export type _Parity_Bar        = AssertNoExtraKeys<ExtraKeys<BarColumnOptions, BarBucketOptions>>;
export type _Parity_Heatmap    = AssertNoExtraKeys<ExtraKeys<HeatmapColumnOptions, HeatmapBucketOptions>>;
export type _Parity_Icon       = AssertNoExtraKeys<ExtraKeys<IconColumnOptions, IconBucketOptions>>;
export type _Parity_Img        = AssertNoExtraKeys<ExtraKeys<ImgColumnOptions, ImgBucketOptions>>;
export type _Parity_Numeric    = AssertNoExtraKeys<ExtraKeys<NumericColumnOptions, NumericBucketOptions>>;
export type _Parity_Percent    = AssertNoExtraKeys<ExtraKeys<PercentColumnOptions, PercentBucketOptions>>;
export type _Parity_Pictogram  = AssertNoExtraKeys<ExtraKeys<PictogramColumnOptions, PictogramBucketOptions>>;
export type _Parity_Progress   = AssertNoExtraKeys<ExtraKeys<ProgressColumnOptions, ProgressBucketOptions>>;
export type _Parity_Pvalue     = AssertNoExtraKeys<ExtraKeys<PvalueColumnOptions, PvalueBucketOptions>>;
export type _Parity_Reference  = AssertNoExtraKeys<ExtraKeys<ReferenceColumnOptions, ReferenceBucketOptions>>;
export type _Parity_Ring       = AssertNoExtraKeys<ExtraKeys<RingColumnOptions, RingBucketOptions>>;
export type _Parity_Sparkline  = AssertNoExtraKeys<ExtraKeys<SparklineColumnOptions, SparklineBucketOptions>>;
export type _Parity_Stars      = AssertNoExtraKeys<ExtraKeys<StarsColumnOptions, StarsBucketOptions>>;
export type _Parity_Text       = AssertNoExtraKeys<ExtraKeys<TextColumnOptions, TextBucketOptions>>;

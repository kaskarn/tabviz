# Sizing-subsystem audit — 2026-06-11

Maintainer-triggered ("might need a full audit of zoom / aspect /
fill-width / column sizing and resizing, and sizing triggers. Something
doesn't smell right"). Verdict: the smell was real — one product-level
defect, two cross-runtime divergences, and several recorded seams.

## Findings and dispositions

| # | Finding | Disposition |
|---|---------|-------------|
| S1 | **Obligate fill-width**: multi-flex gave every column DEFAULT_FLEX_WEIGHT=1 against a container target; a 200px-natural table ballooned to 1076px. Also a DOM↔export divergence (export always content-sized plain tables). | FIXED (D19): growth requires an absorber (flex/plot column or pinned aspect); plain tables hug content + center. |
| S2 | **Estimator font-class-naive**: the proportional character model under-measured monospace ~12%, eating the first column's padding (terminal/synthwave flush text). | FIXED: `estimateTextWidth` mono branch (0.62em advance) + family threaded through the export width paths. |
| S3 | **Parallel label-width path**: `calculateSvgLabelWidth` duplicated padding/clamp/estimator rules. | FIXED (toward D20): deleted; primary measured by `calculateSvgAutoWidths` with a content hook. Remaining label specialness: register D20 (discussion-first). |
| S4 | **systemfonts injection trusted fallback resolutions**: an uninstalled mono family shaped with Helvetica while rsvg rendered Courier-class glyphs → columns collided. | FIXED: metric-class probe ("iiii" vs "MMMM" must shape equal) gates injection for mono stacks; proportional fallback keeps the D8-budgeted path. |
| S5 | **Late centering shift**: content-sized tables painted left then jumped to center when the ResizeObserver's first report landed. | FIXED: synchronous first measurement in the mount effect (offset dims — transform-safe); observer remains steady-state. |
| S6 | Two "available width" definitions: `fitScale` subtracts shell pad; the flex target subtracts container padding. No observed defect; a drift seam. | RECORDED — unify when either changes next. |
| S7 | Aspect ladder's `approxNaturalWidth = effectiveWidth` (container), so the "natural" detent under D19 content-sizing is really CONTAINER aspect for plain tables. | RECORDED — revisit if aspect-pinning a plain table looks wrong in practice (aspect is modifier-gated and forest-centric today). |
| S8 | `layout.totalHeight` floors at container height — short tables claim tall widgets in fixed-height hosts. Auto-fit hosts unaffected. | RECORDED. |
| S9 | Unmeasured DOM columns default natural=100 in the flex distribution ("proportional to natural" is hollow for them); harmless under fill, moot under D19 max-content. | RECORDED — naturals-from-estimator if the DOM distribution ever needs honest proportions. |

## Trigger map (for the next person)

ResizeObserver (container + scalable) → store dims → `layout` $derived
(aspect ladder → flex distribution → row layout) → grid templates →
DOM → measure-then-commit row growth (grow-merge) → `layout`
re-derives. Width measurement does NOT feed back (columnWidths holds
user resizes only) — no ratchet. Zoom/fitScale composes OUTSIDE this
loop as a CSS transform; fit only shrinks.

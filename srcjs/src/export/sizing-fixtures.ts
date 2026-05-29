/**
 * Sizing-harness fixture matrix.
 *
 * A deterministic set of synthetic WebSpecs spanning the scenarios that
 * stress the box model: density presets, wrapping vs short text, indent
 * depth, spacers, group headers, the overall-summary diamond, and mixed
 * column types. Consumed by:
 *   - layout-metrics.test.ts  (snapshot regression gate)
 *   - debug-shapes.ts         (visual box/padding/anchor renderer)
 *
 * Themes come from the REAL resolver (`webTheme({ density })`) so the
 * fixtures exercise actual density-preset token values — a hand-stubbed
 * theme would defeat the whole point of testing compact/spacious.
 *
 * See docs/dev/sizing-model.md.
 */

import { webTheme } from "../lib/theme-api";
import type { WebSpec, Row, ColumnSpec, Group, WebTheme } from "../types";

type Density = "compact" | "comfortable" | "spacious";

// Deterministic RNG so fixtures are byte-stable across runs (no Date/random).
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LONG_LABEL =
  "A deliberately long study label that should wrap across multiple lines when the column is narrow enough to force it";

function dataRow(id: string, label: string, over: Partial<Row> = {}): Row {
  const rng = mulberry32(id.length * 7 + label.length);
  const est = (rng() - 0.5) * 2;
  return {
    id,
    label,
    metadata: {},
    style: {},
    est,
    point: est,
    lower: est - 0.3,
    upper: est + 0.3,
    n: Math.round(rng() * 5000),
    ...over,
  } as unknown as Row;
}

function col(id: string, type: string, header: string, extra: Partial<ColumnSpec> = {}): ColumnSpec {
  return { id, type, field: id, header, options: {}, ...extra } as unknown as ColumnSpec;
}

const LABEL_COL = (extra: Partial<ColumnSpec> = {}) =>
  col("label", "text", "Study", { field: "label", ...extra });
// `flex: true` mirrors the real authoring path — computeLayout only reserves
// plot area for flex columns (svg-generator isFlexColumn), so without it a
// forest column resolves to width 0.
const FOREST_COL = () =>
  ({ id: "est", type: "forest", field: "est", header: "Effect", flex: true, width: null, options: { forest: {} } } as unknown as ColumnSpec);

function spec(parts: {
  density: Density;
  rows: Row[];
  columns?: ColumnSpec[];
  groups?: Group[];
  overall?: boolean;
}): WebSpec {
  const theme = webTheme({ density: parts.density }) as unknown as WebTheme;
  return {
    data: {
      rows: parts.rows,
      groups: parts.groups ?? [],
      overall: parts.overall ? { point: 0, lower: -0.5, upper: 0.5, metadata: {} } : undefined,
    },
    columns: parts.columns ?? [LABEL_COL(), FOREST_COL()],
    theme,
    // `layout` is read by computeLayout's flex-width path (spec.layout.plotWidth);
    // real specs always carry it. Empty object → "auto" forest width.
    layout: {},
    labels: {},
  } as unknown as WebSpec;
}

export interface SizingFixture {
  name: string;
  spec: WebSpec;
}

/** The fixture matrix. Names are stable keys for snapshots. */
export function sizingFixtures(): SizingFixture[] {
  const out: SizingFixture[] = [];
  const densities: Density[] = ["compact", "comfortable", "spacious"];

  const shortRows = (n: number) =>
    Array.from({ length: n }, (_, i) => dataRow(`r${i}`, `Study ${i + 1}`));

  // 1. Density sweep — flat table, short labels. Isolates density tokens.
  for (const d of densities) {
    out.push({ name: `density-${d}-flat`, spec: spec({ density: d, rows: shortRows(6) }) });
  }

  // 2. Density sweep — overall summary present (summary diamond sizing).
  for (const d of densities) {
    out.push({
      name: `density-${d}-overall`,
      spec: spec({ density: d, rows: shortRows(5), overall: true }),
    });
  }

  // 3. Wrapping label — narrow wrap-enabled label column at each density.
  //    Exercises the wrap line-count → row-height inflation path.
  for (const d of densities) {
    out.push({
      name: `wrap-${d}`,
      spec: spec({
        density: d,
        rows: [
          dataRow("w0", LONG_LABEL),
          dataRow("w1", "Short one"),
          dataRow("w2", LONG_LABEL),
        ],
        columns: [
          LABEL_COL({ width: 160, wrap: true } as Partial<ColumnSpec>),
          FOREST_COL(),
        ],
      }),
    });
  }

  // 4. Indent depth — nested rows via style.indent. Exercises indentPerLevel.
  out.push({
    name: "indent-depths",
    spec: spec({
      density: "comfortable",
      rows: [
        dataRow("i0", "Level 0"),
        dataRow("i1", "Level 1", { style: { indent: 1 } } as Partial<Row>),
        dataRow("i2", "Level 2", { style: { indent: 2 } } as Partial<Row>),
        dataRow("i3", "Level 3", { style: { indent: 3 } } as Partial<Row>),
      ],
    }),
  });

  // 5. Spacer rows — half-height separators interleaved.
  out.push({
    name: "spacers",
    spec: spec({
      density: "comfortable",
      rows: [
        dataRow("s0", "Block A — row 1"),
        dataRow("s1", "Block A — row 2"),
        dataRow("sp", "", { style: { type: "spacer" } } as Partial<Row>),
        dataRow("s2", "Block B — row 1"),
      ],
    }),
  });

  // 6. Group headers + rowGroupPadding — two top-level groups.
  {
    const groups: Group[] = [
      { id: "g1", label: "Region A", depth: 0, parentId: null } as unknown as Group,
      { id: "g2", label: "Region B", depth: 0, parentId: null } as unknown as Group,
    ];
    const rows = [
      dataRow("g1r0", "Trial A1", { groupId: "g1" } as Partial<Row>),
      dataRow("g1r1", "Trial A2", { groupId: "g1" } as Partial<Row>),
      dataRow("g2r0", "Trial B1", { groupId: "g2" } as Partial<Row>),
      dataRow("g2r1", "Trial B2", { groupId: "g2" } as Partial<Row>),
    ];
    for (const d of densities) {
      out.push({ name: `groups-${d}`, spec: spec({ density: d, rows, groups }) });
    }
  }

  // 7. Mixed column types — varied widths (text/numeric/badge/bar/forest).
  out.push({
    name: "mixed-columns",
    spec: spec({
      density: "comfortable",
      rows: Array.from({ length: 5 }, (_, i) =>
        dataRow(`m${i}`, `Study ${i + 1}`, {
          pct: 20 + i * 15,
          grade: i % 2 === 0 ? "High" : "Low",
        } as Partial<Row>),
      ),
      columns: [
        LABEL_COL(),
        col("n", "numeric", "N", { field: "n" }),
        col("grade", "badge", "Grade", { field: "grade" }),
        col("pct", "bar", "Weight", { field: "pct", options: { bar: {} } as never }),
        FOREST_COL(),
      ],
    }),
  });

  return out;
}

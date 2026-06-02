/**
 * Region-tree flatten bench (region-tree.md §7).
 *
 * Times `buildRegionTree` + `flatten` — the row-system structural pass that
 * produces `DisplayRow[]` — over a deliberately small, representative fixture
 * (200 rows / ~10 groups). The structure-layer perf contract (region-tree.md §1)
 * only needs to catch a constant-factor or extra-pass regression, which 200 rows
 * surfaces; no 1k/10k sweep.
 *
 *   bun run tests/perf/region-tree-bench.ts
 *
 * Exits non-zero if the median exceeds BUDGET_MS (a generous regression gate, not
 * a tight target). Baseline at authoring: well under 1ms on an M-series laptop.
 */
import { buildRegionTree, flatten, type RegionTreeInput } from "../../src/lib/layout/region-tree";
import type { Row, Group } from "../../src/types";

const ROWS = 200;
const GROUPS = 10; // ~20 rows per group, one level of nesting
const ITERS = 2000;
const BUDGET_MS = 2; // median; ~10× the observed baseline headroom

function buildFixture(): RegionTreeInput {
  const groups: Group[] = [];
  const rows: Row[] = [];
  for (let g = 0; g < GROUPS; g++) {
    groups.push({ id: `g${g}`, label: `Group ${g}`, depth: 0, parentId: null } as Group);
    const per = ROWS / GROUPS;
    for (let r = 0; r < per; r++) {
      const id = `g${g}-r${r}`;
      rows.push({ id, label: id, groupId: `g${g}`, metadata: {} } as Row);
    }
  }
  return { groups, visibleRows: rows, rowOrder: { byGroup: {}, groupOrderByParent: {} } };
}

function timeMedian(fn: () => void, iters: number): number {
  for (let i = 0; i < 50; i++) fn(); // warm
  const samples: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function main(): void {
  const input = buildFixture();
  const collapsed = new Set<string>();

  // Sanity: the fixture flattens to header+rows (10 headers + 200 rows = 210).
  const units = flatten(buildRegionTree(input), collapsed);
  if (units.length !== ROWS + GROUPS) {
    console.error(`✗ unexpected unit count ${units.length} (want ${ROWS + GROUPS})`);
    process.exit(1);
  }

  const buildMs = timeMedian(() => void buildRegionTree(input), ITERS);
  const tree = buildRegionTree(input);
  const flattenMs = timeMedian(() => void flatten(tree, collapsed), ITERS);
  const totalMs = timeMedian(() => void flatten(buildRegionTree(input), collapsed), ITERS);

  console.log(`region-tree bench (${ROWS} rows / ${GROUPS} groups, median of ${ITERS}):`);
  console.log(`  buildRegionTree : ${buildMs.toFixed(4)} ms`);
  console.log(`  flatten         : ${flattenMs.toFixed(4)} ms`);
  console.log(`  build + flatten : ${totalMs.toFixed(4)} ms`);

  if (totalMs > BUDGET_MS) {
    console.error(`✗ build+flatten median ${totalMs.toFixed(4)}ms exceeds budget ${BUDGET_MS}ms`);
    process.exit(1);
  }
  console.log(`✓ within budget (${BUDGET_MS}ms)`);
}

main();

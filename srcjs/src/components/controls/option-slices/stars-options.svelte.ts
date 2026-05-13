// Stars-column option state, extracted from ColumnEditorPopover.svelte.
// Phase 0c-C3.

import type { ColumnSpec } from "$types";

export interface StarsOptionsSlice {
  maxStars: string;
  domainMin: string;
  domainMax: string;
  reset(): void;
  hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
  buildOptions(): NonNullable<NonNullable<ColumnSpec["options"]>["stars"]>;
}

export function createStarsOptionsSlice(): StarsOptionsSlice {
  let maxStars = $state<string>("");
  let domainMin = $state<string>("");
  let domainMax = $state<string>("");

  return {
    get maxStars() { return maxStars; },
    set maxStars(v) { maxStars = v; },
    get domainMin() { return domainMin; },
    set domainMin(v) { domainMin = v; },
    get domainMax() { return domainMax; },
    set domainMax(v) { domainMax = v; },
    reset(): void {
      maxStars = "";
      domainMin = "";
      domainMax = "";
    },
    hydrateFromSpec(o): void {
      if (o.stars?.maxStars != null) maxStars = String(o.stars.maxStars);
      if (o.stars?.domain) {
        domainMin = String(o.stars.domain[0]);
        domainMax = String(o.stars.domain[1]);
      }
    },
    buildOptions(): NonNullable<NonNullable<ColumnSpec["options"]>["stars"]> {
      const st: NonNullable<NonNullable<ColumnSpec["options"]>["stars"]> = {};
      if (maxStars !== "") {
        const n = Math.max(1, Math.min(20, Math.round(Number(maxStars))));
        st.maxStars = n;
      }
      if (domainMin !== "" && domainMax !== "") {
        const lo = Number(domainMin);
        const hi = Number(domainMax);
        if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
          st.domain = [lo, hi];
        }
      }
      return st;
    },
  };
}

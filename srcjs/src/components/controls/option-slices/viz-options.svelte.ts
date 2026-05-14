// Viz-column option state (viz_bar / viz_boxplot / viz_violin).
// Phase 0c-C3. The slice handles all three types because they share the
// effects-array UI structure; the differences are in which per-effect
// fields are required and which options-bundle key the result goes
// into.

import type { ColumnSpec } from "$types";

/**
 * Loose per-effect row used while editing. Field set is the union of
 * what viz_bar / viz_boxplot / viz_violin need; on commit we strip
 * irrelevant fields per the active type.
 */
export interface VizEffectRow {
  label?: string;
  color?: string;
  opacity?: string; // stringified for the number input; empty = "no override"
  value?: string;   // viz_bar
  data?: string;    // viz_violin + viz_boxplot (array mode)
  min?: string;
  q1?: string;
  median?: string;
  q3?: string;
  max?: string;
  outliers?: string; // viz_boxplot (stats mode, last column optional)
}

export type VizType = "viz_bar" | "viz_boxplot" | "viz_violin";
export type VizBoxplotMode = "array" | "stats";

export interface VizOptionsSlice {
  effects: VizEffectRow[];
  boxplotMode: VizBoxplotMode;
  addEffect(): void;
  removeEffect(idx: number): void;
  moveEffect(idx: number, delta: number): void;
  updateEffect(idx: number, patch: Partial<VizEffectRow>): void;
  setBoxplotMode(mode: VizBoxplotMode): void;
  reset(initial: boolean): void;
  hydrateFromSpec(ex: ColumnSpec): void;
  /**
   * True iff the primary data field(s) for every effect have been
   * filled in for the active type. Validation gate for canCommit.
   */
  isPrimaryValueResolved(type: VizType): boolean;
  /**
   * Build the type-specific options bundle. Returns the inner bar /
   * boxplot / violin slice ready to be stored under
   * `options.bar`/`options.boxplot`/`options.violin`.
   */
  buildOptions(type: VizType): Record<string, unknown>;
}

function newEffect(): VizEffectRow {
  return {};
}

export function createVizOptionsSlice(): VizOptionsSlice {
  let effects = $state<VizEffectRow[]>([]);
  let boxplotMode = $state<VizBoxplotMode>("array");

  return {
    get effects() { return effects; },
    set effects(v) { effects = v; },
    get boxplotMode() { return boxplotMode; },
    set boxplotMode(v) { boxplotMode = v; },

    addEffect(): void {
      effects = [...effects, newEffect()];
    },
    removeEffect(idx): void {
      effects = effects.filter((_, i) => i !== idx);
    },
    moveEffect(idx, delta): void {
      const next = [...effects];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return;
      [next[idx], next[target]] = [next[target], next[idx]];
      effects = next;
    },
    updateEffect(idx, patch): void {
      effects = effects.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    },
    setBoxplotMode(mode): void {
      boxplotMode = mode;
    },

    /**
     * `initial=true` seeds a single empty effect (matches the legacy
     * behavior when switching to a viz type for the first time).
     * `initial=false` clears the array (used by full resetOptions).
     */
    reset(initial): void {
      effects = initial ? [newEffect()] : [];
      boxplotMode = "array";
    },

    hydrateFromSpec(ex): void {
      const o = ex.options ?? {};
      if (ex.type === "viz_bar") {
        const effs = (o.vizBar?.effects ?? []) as unknown as Array<Record<string, unknown>>;
        effects = effs.map((e) => ({
          value: (e.value as string) ?? "",
          label: (e.label as string) ?? "",
          color: (e.color as string) ?? "",
          opacity: e.opacity != null ? String(e.opacity) : "",
        }));
      } else if (ex.type === "viz_boxplot") {
        const effs = (o.vizBoxplot?.effects ?? []) as Array<Record<string, unknown>>;
        const first = effs[0] ?? {};
        boxplotMode = first.data ? "array" : "stats";
        effects = effs.map((e) => ({
          data: (e.data as string) ?? "",
          min: (e.min as string) ?? "",
          q1: (e.q1 as string) ?? "",
          median: (e.median as string) ?? "",
          q3: (e.q3 as string) ?? "",
          max: (e.max as string) ?? "",
          outliers: (e.outliers as string) ?? "",
          label: (e.label as string) ?? "",
          color: (e.color as string) ?? "",
          opacity: e.opacity != null ? String(e.opacity) : "",
        }));
      } else if (ex.type === "viz_violin") {
        const effs = (o.vizViolin?.effects ?? []) as unknown as Array<Record<string, unknown>>;
        effects = effs.map((e) => ({
          data: (e.data as string) ?? "",
          label: (e.label as string) ?? "",
          color: (e.color as string) ?? "",
          opacity: e.opacity != null ? String(e.opacity) : "",
        }));
      }
    },

    isPrimaryValueResolved(type): boolean {
      if (type === "viz_bar") {
        return effects.length > 0 && effects.every((e) => !!e.value);
      }
      if (type === "viz_boxplot") {
        if (effects.length === 0) return false;
        if (boxplotMode === "array") {
          return effects.every((e) => !!e.data);
        }
        return effects.every(
          (e) => !!e.min && !!e.q1 && !!e.median && !!e.q3 && !!e.max,
        );
      }
      if (type === "viz_violin") {
        return effects.length > 0 && effects.every((e) => !!e.data);
      }
      return false;
    },

    buildOptions(type): Record<string, unknown> {
      if (type === "viz_bar") {
        return {
          type: "bar",
          effects: effects
            .filter((e) => e.value)
            .map((e) => {
              const out: Record<string, unknown> = { value: e.value };
              if (e.label) out.label = e.label;
              if (e.color) out.color = e.color;
              if (e.opacity !== undefined && e.opacity !== "") {
                const op = Number(e.opacity);
                if (Number.isFinite(op)) out.opacity = op;
              }
              return out;
            }),
        };
      }
      if (type === "viz_boxplot") {
        return {
          type: "boxplot",
          effects: effects.map((e) => {
            const out: Record<string, unknown> = {};
            if (boxplotMode === "array") {
              if (e.data) out.data = e.data;
            } else {
              if (e.min) out.min = e.min;
              if (e.q1) out.q1 = e.q1;
              if (e.median) out.median = e.median;
              if (e.q3) out.q3 = e.q3;
              if (e.max) out.max = e.max;
              if (e.outliers) out.outliers = e.outliers;
            }
            if (e.label) out.label = e.label;
            if (e.color) out.color = e.color;
            if (e.opacity !== undefined && e.opacity !== "") {
              const op = Number(e.opacity);
              if (Number.isFinite(op)) out.opacity = op;
            }
            return out;
          }),
        };
      }
      if (type === "viz_violin") {
        return {
          type: "violin",
          effects: effects
            .filter((e) => e.data)
            .map((e) => {
              const out: Record<string, unknown> = { data: e.data };
              if (e.label) out.label = e.label;
              if (e.color) out.color = e.color;
              if (e.opacity !== undefined && e.opacity !== "") {
                const op = Number(e.opacity);
                if (Number.isFinite(op)) out.opacity = op;
              }
              return out;
            }),
        };
      }
      return {};
    },
  };
}

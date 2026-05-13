// Numeric-column option state. Phase 0c-C3.

import type { ColumnSpec } from "$types";

export interface NumericOptionsSlice {
  decimals: string;
  prefix: string;
  suffix: string;
  thousandsSep: boolean;
  reset(): void;
  hydrateFromSpec(o: NonNullable<ColumnSpec["options"]>): void;
  buildOptions(): NonNullable<NonNullable<ColumnSpec["options"]>["numeric"]>;
}

export function createNumericOptionsSlice(): NumericOptionsSlice {
  let decimals = $state<string>("");
  let prefix = $state<string>("");
  let suffix = $state<string>("");
  let thousandsSep = $state<boolean>(false);

  return {
    get decimals() { return decimals; },
    set decimals(v) { decimals = v; },
    get prefix() { return prefix; },
    set prefix(v) { prefix = v; },
    get suffix() { return suffix; },
    set suffix(v) { suffix = v; },
    get thousandsSep() { return thousandsSep; },
    set thousandsSep(v) { thousandsSep = v; },
    reset(): void {
      decimals = "";
      prefix = "";
      suffix = "";
      thousandsSep = false;
    },
    hydrateFromSpec(o): void {
      if (o.numeric?.decimals != null) decimals = String(o.numeric.decimals);
      if (o.numeric?.prefix != null) prefix = o.numeric.prefix;
      if (o.numeric?.suffix != null) suffix = o.numeric.suffix;
      // thousandsSep: string ("," etc) or false; UI is a boolean checkbox.
      if (o.numeric?.thousandsSep != null) thousandsSep = o.numeric.thousandsSep !== false;
    },
    buildOptions(): NonNullable<NonNullable<ColumnSpec["options"]>["numeric"]> {
      const num: NonNullable<NonNullable<ColumnSpec["options"]>["numeric"]> = {};
      if (decimals !== "") num.decimals = Number(decimals);
      if (prefix !== "") num.prefix = prefix;
      if (suffix !== "") num.suffix = suffix;
      if (thousandsSep) num.thousandsSep = ",";
      return num;
    },
  };
}

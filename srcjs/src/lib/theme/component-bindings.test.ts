// Component-model wiring gate (W6 Stage 1 — docs/dev/component-model.md).
//
// Pins the chain for the NEW middle verb (re-route a component channel):
// manifest `binding` annotations → COMPONENT_ROSTER → `components` wire
// block → BOTH resolve paths (getCssVars + the paint CSS share
// getCssVarsRaw) → ingress validation (parseThemeWire). Mirrors
// role-overrides-wiring.test.ts, which guards the same lockstep for
// roleOverrides/pins.

import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-adapter";
import { getCssVars } from "./consumer-bridge";
import { buildThemeCSS } from "./theme-css";
import { PRESETS } from "./theme-presets-inputs";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { buildThemeWire } from "./theme-wire";
import { parseThemeWire, ThemeWireParseError } from "./theme-wire-parse";
import {
  COMPONENT_ROSTER,
  componentRoster,
  sanitizeComponentBindings,
  isValidChannelValue,
} from "./component-bindings";
import { COMPONENT_TOKENS, KNOWN_UNCONSUMED } from "./component-tokens";

const inputs = PRESETS["nejm"]!;

describe("COMPONENT_ROSTER (manifest binding annotations)", () => {
  it("contains the Stage-1 curated components with their regions", () => {
    const expected: Record<string, string> = {
      "row": "rows", "cell": "rows", "numeric-cell": "rows",
      "header-cell": "header",
      "axis-line": "plot", "axis-tick": "plot",
      "axis-label": "plot", "axis-tick-label": "plot",
      "title": "captions", "subtitle": "captions", "caption": "captions",
      "footnote": "captions", "caption-chip": "captions",
    };
    for (const [name, region] of Object.entries(expected)) {
      const d = COMPONENT_ROSTER.get(name);
      expect(d, `component ${name} missing from roster`).toBeDefined();
      expect(d!.region).toBe(region as never);
    }
  });

  it("row exposes its interaction/paint states", () => {
    const row = COMPONENT_ROSTER.get("row")!;
    // `selected` is annotated but its token (--tv-row-selected-bg) is
    // KNOWN_UNCONSUMED headroom — the honesty filter keeps it OUT of the
    // roster until selection paint actually reads it.
    for (const s of ["base", "alt", "hover", "emphasis"] as const) {
      expect(row.states.has(s), `row missing state ${s}`).toBe(true);
    }
    expect(row.states.has("selected")).toBe(false);
    expect(row.states.get("emphasis")!.has("bar")).toBe(true);
  });

  it("header-cell models the three style variants as states", () => {
    const hc = COMPONENT_ROSTER.get("header-cell")!;
    for (const s of ["light", "tint", "fill"] as const) {
      expect(hc.states.has(s), `header-cell missing variant state ${s}`).toBe(true);
    }
    expect(hc.states.get("light")!.has("bg")).toBe(true);
    expect(hc.states.get("light")!.has("col")).toBe(true);
    // light.rule is honesty-filtered (--tv-header-light-rule unconsumed).
    expect(hc.states.get("light")!.has("rule")).toBe(false);
  });

  it("HONESTY GATE: every annotated token's resolver honors a re-route", () => {
    // Only resolvers that consult componentChannelOverride may carry
    // annotations (role/typography/anchor/ramp-direct as of W4 ports).
    // An annotation on any other group would advertise an editable channel
    // nothing reads — the exact bug class the consumedBy drift gate exists
    // for. Extend the resolver FIRST, then annotate.
    for (const t of COMPONENT_TOKENS) {
      if (!t.binding) continue;
      expect(
        ["role", "typography", "anchor", "ramp-direct", "header-active", "first-col", "borders"].includes(t.resolverGroup),
        `${t.cssVar} is annotated (${t.binding.component}.${t.binding.channel}) ` +
        `but its resolverGroup "${t.resolverGroup}" does not honor re-routes`,
      ).toBe(true);
    }
  });

  it("HONESTY GATE: no roster channel is backed by an unconsumed token", () => {
    // KNOWN_UNCONSUMED tokens are emitted headroom — nothing paints them,
    // so a channel routed through one is editable-but-inert. The roster
    // derivation must skip them (they join as Stage 3 wires consumers,
    // DOM + export together).
    for (const d of COMPONENT_ROSTER.values()) {
      for (const channels of d.states.values()) {
        for (const token of channels.values()) {
          expect(
            KNOWN_UNCONSUMED.has(token.cssVar),
            `${d.component}: channel backed by unconsumed ${token.cssVar}`,
          ).toBe(false);
        }
      }
    }
  });

  it("componentRoster() projects to JSON-able shape for R/V8", () => {
    const r = componentRoster();
    expect(r["title"]!.region).toBe("captions");
    expect(r["title"]!.states["base"]!["col"]).toBe("--tv-text-title-fg");
    expect(r["row"]!.states["emphasis"]!["bar"]).toBe("--tv-row-emphasis-bar");
  });
});

describe("sanitizeComponentBindings (the ONE ingress validator)", () => {
  it("accepts a valid sparse block", () => {
    const { bindings, issues } = sanitizeComponentBindings({
      title: { base: { col: "accent-text", family: "mono" } },
      row: { alt: { bg: "fill" } },
    });
    expect(issues).toEqual([]);
    expect(bindings["title"]!.base!.col).toBe("accent-text");
    expect(bindings["row"]!.alt!.bg).toBe("fill");
  });

  it("rejects unknown components / states / channels / values with paths", () => {
    const { bindings, issues } = sanitizeComponentBindings({
      "no-such": { base: { col: "text" } },
      title: {
        hover: { col: "text" },              // title has no hover state
        base: { bg: "text", col: "nope" },   // title has no bg channel; bad role
      },
    });
    expect(bindings).toEqual({});
    const paths = issues.map((i) => i.path);
    expect(paths).toContain("components.no-such");
    expect(paths).toContain("components.title.hover");
    expect(paths).toContain("components.title.base.bg");
    expect(paths).toContain("components.title.base.col");
  });

  it("keeps the valid parts while reporting the invalid ones", () => {
    const { bindings, issues } = sanitizeComponentBindings({
      title: { base: { col: "text-subtle", weight: "ultra" } },
    });
    expect(bindings["title"]!.base!.col).toBe("text-subtle");
    expect(bindings["title"]!.base!.weight).toBeUndefined();
    expect(issues.length).toBe(1);
  });

  it("non-object shapes produce a structural issue, never a throw", () => {
    expect(sanitizeComponentBindings([1, 2]).issues[0]!.code).toBe("shape");
    expect(sanitizeComponentBindings("x").issues[0]!.code).toBe("shape");
    expect(sanitizeComponentBindings(null).issues).toEqual([]);
  });

  it("channel value typing: roles for color, slots for type", () => {
    expect(isValidChannelValue("col", "pos-text")).toBe(true);   // off-ramp OK to re-route
    expect(isValidChannelValue("col", "display")).toBe(false);
    expect(isValidChannelValue("family", "numeric")).toBe(true);
    expect(isValidChannelValue("family", "Comic Sans")).toBe(false);
    expect(isValidChannelValue("size", "subtitle")).toBe(true);
    expect(isValidChannelValue("weight", "semibold")).toBe(true);
    expect(isValidChannelValue("weight", "650")).toBe(false);
  });
});

describe("re-route reaches BOTH resolve paths (the lockstep gate)", () => {
  it("a color re-route redirects the token to the new role", () => {
    const resolved = resolveTheme({
      ...createWire(inputs, "x"),
      components: { title: { base: { col: "text-subtle" } } },
    });
    expect(resolved.cssVars["--tv-text-title-fg"]).toBe(resolved.roles["text-subtle"]);
  });

  it("re-routes flow through buildTheme → getCssVars AND the paint CSS", () => {
    const plain = buildTheme(inputs, "p");
    const routed = buildTheme(inputs, {
      name: "r",
      components: { title: { base: { col: "text-subtle" } } },
    });
    expect(routed.components?.["title"]?.["base"]?.["col"]).toBe("text-subtle");
    const v0 = getCssVars(plain);
    const v1 = getCssVars(routed);
    expect(v1["--tv-text-title-fg"]).not.toBe(v0["--tv-text-title-fg"]);
    // Paint path (theme-css) must agree with the export path (getCssVars).
    expect(buildThemeCSS(routed)).toContain(v1["--tv-text-title-fg"]!);
    expect(buildThemeCSS(routed)).not.toBe(buildThemeCSS(plain));
  });

  it("a typography re-route equals the equivalent type_roles rebind", () => {
    const viaComponents = buildTheme(inputs, {
      name: "c",
      components: { title: { base: { weight: "regular", family: "mono" } } },
    });
    const viaTypeRoles = buildTheme(
      { ...inputs, type_roles: { title: { weight: "regular", family: "mono" } } },
      "t",
    );
    const vc = getCssVars(viaComponents);
    const vt = getCssVars(viaTypeRoles);
    expect(vc["--tv-text-title-weight"]).toBe(vt["--tv-text-title-weight"]!);
    expect(vc["--tv-text-title-family"]).toBe(vt["--tv-text-title-family"]!);
    // And it actually changed something.
    expect(vc["--tv-text-title-family"]).not.toBe(
      getCssVars(buildTheme(inputs, "p2"))["--tv-text-title-family"],
    );
  });

  it("re-route is token-local: it beats the role-level type_roles rebind", () => {
    const t = buildTheme(
      { ...inputs, type_roles: { title: { weight: "regular" } } },
      {
        name: "x",
        components: { title: { base: { weight: "bold" } } },
      },
    );
    const tBold = buildTheme(
      { ...inputs, type_roles: { title: { weight: "bold" } } }, "y");
    expect(getCssVars(t)["--tv-text-title-weight"])
      .toBe(getCssVars(tBold)["--tv-text-title-weight"]!);
  });

  it("cache is components-aware: same inputs identity, different routes", () => {
    const a = buildTheme(inputs, {
      name: "a", components: { footnote: { base: { col: "text" } } },
    });
    const b = buildTheme(inputs, {
      name: "b", components: { footnote: { base: { col: "accent-text" } } },
    });
    const plain = buildTheme(inputs, "c");
    const va = getCssVars(a)["--tv-text-footnote-fg"];
    const vb = getCssVars(b)["--tv-text-footnote-fg"];
    const vp = getCssVars(plain)["--tv-text-footnote-fg"];
    expect(va).not.toBe(vb);
    expect(vp).not.toBe(va); // default (text-subtle) uncontaminated
  });

  it("HC mode ratchet beats a re-route (same precedence as pins)", () => {
    const hc = buildTheme(
      { ...inputs, mode: "high-contrast" },
      {
        name: "hc",
        components: { row: { alt: { bg: "fill" } } },
        skipValidation: true,
      },
    );
    // --tv-row-alt-bg declares modes.hc = "drop" — the ratchet must win.
    expect(getCssVars(hc)["--tv-row-alt-bg"]).toBe("transparent");
  });

  it("defense-in-depth: a garbage value via opts is ignored, not emitted", () => {
    const t = buildTheme(inputs, {
      name: "g",
      components: { title: { base: { col: "<script>" } } } as never,
    });
    const v = getCssVars(t)["--tv-text-title-fg"]!;
    expect(v).toBe(getCssVars(buildTheme(inputs, "p3"))["--tv-text-title-fg"]!);
    expect(v).not.toContain("<");
  });
});

describe("components on the wire envelope", () => {
  it("buildThemeWire emits components only when non-empty", () => {
    const bare = buildThemeWire(inputs, "a");
    expect("components" in bare).toBe(false);
    const wire = buildThemeWire(inputs, "b", {}, {},
      { title: { base: { col: "accent-text" } } });
    expect(wire.components!["title"]!.base!.col).toBe("accent-text");
  });

  it("parseThemeWire round-trips a valid components block", () => {
    const wire = buildThemeWire(inputs, "rt", {}, {},
      { row: { emphasis: { bar: "accent-solid" } } });
    const parsed = parseThemeWire(JSON.stringify(wire));
    expect(parsed.components!["row"]!.emphasis!.bar).toBe("accent-solid");
  });

  it("parseThemeWire rejects an invalid components block with paths", () => {
    const wire = {
      ...buildThemeWire(inputs, "bad"),
      components: { "no-such": { base: { col: "text" } } },
    };
    let err: ThemeWireParseError | null = null;
    try {
      parseThemeWire(JSON.stringify(wire));
    } catch (e) {
      err = e as ThemeWireParseError;
    }
    expect(err).toBeInstanceOf(ThemeWireParseError);
    expect(err!.issues.some((i) => i.path === "components.no-such")).toBe(true);
  });
});

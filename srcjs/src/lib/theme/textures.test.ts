// Stage 2 §3 — texture color tests (shell-only since the spacing rework;
// the paper-texture fallthrough and the never-consumed SVG pattern helpers
// were deleted 2026-06-05).

import { describe, it, expect } from "bun:test";
import { resolveTextureColors, textureKeyForCssVar, resolveTextureKnockoutBg } from "./textures";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

describe("resolveTextureColors", () => {
  it("returns shell colors keyed on neutral grade", () => {
    const ramp = ["#000", "#111", "#222", "#333", "#444", "#555", "#666", "#777", "#888", "#999", "#aaa", "#bbb"];
    const r = resolveTextureColors(ramp);
    expect(r.shellLine).toBe("#222");  // grade 3 (0-indexed 2)
    expect(r.shellDot).toBe("#333");   // grade 4
  });

  it("handles short ramps gracefully", () => {
    const r = resolveTextureColors(["#000"]);
    expect(r.shellLine).toBe("#000");
    expect(r.shellDot).toBe("#000");
  });
});

describe("textureKeyForCssVar", () => {
  it("maps the shell texture cssVars", () => {
    expect(textureKeyForCssVar("--tv-shell-texture-line")).toBe("shellLine");
    expect(textureKeyForCssVar("--tv-shell-texture-dot")).toBe("shellDot");
  });

  it("returns null for non-texture vars (incl. the deleted paper twins)", () => {
    expect(textureKeyForCssVar("--tv-shadow-raised-near")).toBeNull();
    expect(textureKeyForCssVar("--tv-paper-texture-line")).toBeNull();
    expect(textureKeyForCssVar("--tv-paper-texture-dot")).toBeNull();
  });
});

describe("texture knockouts (Stage 2 §4)", () => {
  it("resolveTextureKnockoutBg premixes hex against white at 78%", () => {
    // Pure black at 78% → ~22% white = #383838
    expect(resolveTextureKnockoutBg("#000000")).toBe("#383838");
    // Pure white stays white
    expect(resolveTextureKnockoutBg("#FFFFFF")).toBe("#ffffff");
  });

  it("transparent or unrecognized surface → rgba fallback", () => {
    expect(resolveTextureKnockoutBg("transparent")).toBe("rgba(255,255,255,0.78)");
  });

  it("knockout cssVar resolves to hex when shell-mode produces a hex surface", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { shell_mode: "raised" }), "t"));
    expect(r.cssVars["--tv-shell-text-knockout-bg"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("flush mode → shell knockout premixes the PAPER bg (transparent shells fall back to paper, not white)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { shell_mode: "flush" }), "t"));
    // Caption/footer text sits on the (transparent) shell over the page;
    // a white premix behind light text on dark themes was illegible —
    // the resolver now premixes against the paper surface instead.
    expect(r.cssVars["--tv-shell-text-knockout-bg"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("texture → cssVars integration", () => {
  it("emits the 2 shell texture cssVars and no paper twins", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    expect(r.cssVars["--tv-shell-texture-line"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.cssVars["--tv-shell-texture-dot"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.cssVars["--tv-paper-texture-line"]).toBeUndefined();
    expect(r.cssVars["--tv-paper-texture-dot"]).toBeUndefined();
  });
});

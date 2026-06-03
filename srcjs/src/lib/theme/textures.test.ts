// Stage 2 §3 — texture color + SVG pattern tests.

import { describe, it, expect } from "bun:test";
import { resolveTextureColors, textureKeyForCssVar, svgTexturePattern } from "./textures";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";

describe("resolveTextureColors", () => {
  it("returns 4 colors keyed on neutral grade", () => {
    const ramp = ["#000", "#111", "#222", "#333", "#444", "#555", "#666", "#777", "#888", "#999", "#aaa", "#bbb"];
    const r = resolveTextureColors(ramp);
    expect(r.shellLine).toBe("#222");  // grade 3 (0-indexed 2)
    expect(r.shellDot).toBe("#333");   // grade 4
    expect(r.paperLine).toBe("#222");
    expect(r.paperDot).toBe("#333");
  });

  it("handles short ramps gracefully", () => {
    const r = resolveTextureColors(["#000"]);
    expect(r.shellLine).toBe("#000");
    expect(r.shellDot).toBe("#000");
  });
});

describe("textureKeyForCssVar", () => {
  it("maps all 4 texture cssVars", () => {
    expect(textureKeyForCssVar("--tv-shell-texture-line")).toBe("shellLine");
    expect(textureKeyForCssVar("--tv-shell-texture-dot")).toBe("shellDot");
    expect(textureKeyForCssVar("--tv-paper-texture-line")).toBe("paperLine");
    expect(textureKeyForCssVar("--tv-paper-texture-dot")).toBe("paperDot");
  });

  it("returns null for non-texture vars", () => {
    expect(textureKeyForCssVar("--tv-shadow-raised-near")).toBeNull();
  });
});

describe("svgTexturePattern", () => {
  it("returns null for 'none'", () => {
    expect(svgTexturePattern("none")).toBeNull();
  });

  it("ruled emits a <pattern> with a horizontal line", () => {
    const p = svgTexturePattern("ruled");
    expect(p).toContain("<pattern");
    expect(p).toContain("<line");
    expect(p).toContain("stroke=");
  });

  it("grid emits two perpendicular lines", () => {
    const p = svgTexturePattern("grid");
    const lineCount = (p?.match(/<line/g) ?? []).length;
    expect(lineCount).toBe(2);
  });

  it("dotted emits a circle", () => {
    const p = svgTexturePattern("dotted");
    expect(p).toContain("<circle");
  });

  it("grain emits a fractalNoise filter", () => {
    const p = svgTexturePattern("grain");
    expect(p).toContain("fractalNoise");
  });

  it("paper surface uses paper-side cssVars", () => {
    const p = svgTexturePattern("ruled", "paper");
    expect(p).toContain("--tv-paper-texture-line");
  });

  it("shell surface uses shell-side cssVars", () => {
    const p = svgTexturePattern("ruled", "shell");
    expect(p).toContain("--tv-shell-texture-line");
  });
});

describe("texture → cssVars integration", () => {
  it("emits 4 texture cssVars", () => {
    const r = resolveTheme(createWire({ brand: "#0099CC" }, "t"));
    expect(r.cssVars["--tv-shell-texture-line"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.cssVars["--tv-shell-texture-dot"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.cssVars["--tv-paper-texture-line"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.cssVars["--tv-paper-texture-dot"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

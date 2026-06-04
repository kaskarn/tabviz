// Stage 2 §2 — shell/paper unit + integration tests.

import { describe, it, expect } from "bun:test";
import { resolveShellPaper, shellPaperKeyForCssVar } from "./shell-paper";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

const ROLES = { surface: "#FFFFFF", surfaceSubtle: "#F4F4F4", border: "#CCCCCC", borderSubtle: "#E5E5E5" };

describe("resolveShellPaper", () => {
  it("flush: shell transparent, paper takes surface", () => {
    const r = resolveShellPaper(inputsFromHex({ brand: "#000" }, { shell_mode: "flush" }), ROLES);
    expect(r.shellBg).toBe("transparent");
    expect(r.shellShadow).toBe("none");
    expect(r.paperBg).toBe("#FFFFFF");
    expect(r.paperShadow).toBe("none");
  });

  it("raised: shell is a card, paper sits with inset", () => {
    const r = resolveShellPaper(inputsFromHex({ brand: "#000" }, { shell_mode: "raised" }), ROLES);
    expect(r.shellBg).toBe("#F4F4F4");
    expect(r.shellShadow).toContain("rgba");
    expect(r.paperBg).toBe("#FFFFFF");
    expect(r.paperShadow).toContain("inset");
  });

  it("float: shell transparent, paper has drop shadow", () => {
    const r = resolveShellPaper(inputsFromHex({ brand: "#000" }, { shell_mode: "float" }), ROLES);
    expect(r.shellBg).toBe("transparent");
    expect(r.paperBg).toBe("#FFFFFF");
    expect(r.paperShadow).toContain("rgba");
    expect(r.paperShadow).not.toContain("inset");
  });

  it("transparent: everything chromeless", () => {
    const r = resolveShellPaper(inputsFromHex({ brand: "#000" }, { shell_mode: "transparent" }), ROLES);
    expect(r.shellBg).toBe("transparent");
    expect(r.shellBorder).toBe("transparent");
    expect(r.paperBorder).toBe("transparent");
    expect(r.paperShadow).toBe("none");
  });

  it("default mode is flush", () => {
    const r = resolveShellPaper(inputsFromHex({ brand: "#000" }), ROLES);
    expect(r.shellBg).toBe("transparent");
    expect(r.paperBg).toBe("#FFFFFF");
  });
});

describe("shellPaperKeyForCssVar", () => {
  it("maps all 10 shell/paper cssVars", () => {
    const vars = ["--tv-shell-bg", "--tv-shell-border", "--tv-shell-shadow",
                  "--tv-shell-radius", "--tv-shell-padding",
                  "--tv-paper-bg", "--tv-paper-border", "--tv-paper-shadow",
                  "--tv-paper-radius", "--tv-paper-padding"];
    for (const v of vars) {
      expect(shellPaperKeyForCssVar(v)).not.toBeNull();
    }
  });

  it("returns null for non-shell-paper vars", () => {
    expect(shellPaperKeyForCssVar("--tv-row-base-bg")).toBeNull();
    expect(shellPaperKeyForCssVar("--tv-text-title-size")).toBeNull();
  });
});

describe("shell/paper → cssVars integration", () => {
  it("flush emits paper-bg, transparent shell", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { shell_mode: "flush" }), "t"));
    expect(r.cssVars["--tv-shell-bg"]).toBe("transparent");
    expect(r.cssVars["--tv-paper-bg"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("raised emits card-style shell", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { shell_mode: "raised" }), "t"));
    expect(r.cssVars["--tv-shell-shadow"]).toContain("rgba");
    expect(r.cssVars["--tv-shell-radius"]).toBe("12px");
  });

  it("float emits paper drop shadow", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { shell_mode: "float" }), "t"));
    expect(r.cssVars["--tv-paper-shadow"]).toContain("rgba");
    expect(r.cssVars["--tv-shell-bg"]).toBe("transparent");
  });

  it("default (no shell_mode) behaves as flush", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    expect(r.cssVars["--tv-shell-bg"]).toBe("transparent");
  });

  it("no placeholders leak for shell/paper tokens", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { shell_mode: "raised" }), "t"));
    const keys = ["--tv-shell-bg", "--tv-shell-border", "--tv-shell-shadow",
                  "--tv-shell-radius", "--tv-shell-padding",
                  "--tv-paper-bg", "--tv-paper-border", "--tv-paper-shadow",
                  "--tv-paper-radius", "--tv-paper-padding"];
    for (const k of keys) {
      expect(r.cssVars[k]).not.toMatch(/^</);
    }
  });
});

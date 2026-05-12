import { describe, test, expect } from "bun:test";
import {
  CURRENT_VERSION,
  SUPPORTED_MAJORS,
  parseSpecVersion,
  validateSpecVersion,
} from "./index.ts";

describe("parseSpecVersion", () => {
  test("parses 'major.minor' shape", () => {
    expect(parseSpecVersion("1.0")).toEqual({ major: "1", minor: "0", raw: "1.0" });
    expect(parseSpecVersion("2.7")).toEqual({ major: "2", minor: "7", raw: "2.7" });
  });

  test("parses 'major.minor.patch' shape", () => {
    expect(parseSpecVersion("1.0.3")).toEqual({ major: "1", minor: "0.3", raw: "1.0.3" });
  });

  test("parses major-only", () => {
    expect(parseSpecVersion("1")).toEqual({ major: "1", minor: null, raw: "1" });
  });

  test("trims whitespace", () => {
    expect(parseSpecVersion("  1.0  ")).toEqual({ major: "1", minor: "0", raw: "  1.0  " });
  });

  test("rejects non-string inputs", () => {
    expect(parseSpecVersion(undefined)).toBeNull();
    expect(parseSpecVersion(null)).toBeNull();
    expect(parseSpecVersion(1)).toBeNull();
    expect(parseSpecVersion({})).toBeNull();
    expect(parseSpecVersion([])).toBeNull();
  });

  test("rejects non-numeric shapes", () => {
    expect(parseSpecVersion("")).toBeNull();
    expect(parseSpecVersion("v1.0")).toBeNull();
    expect(parseSpecVersion("1.0-pre")).toBeNull();
    expect(parseSpecVersion("latest")).toBeNull();
  });
});

describe("validateSpecVersion", () => {
  test("accepts the current version", () => {
    const payload = { version: CURRENT_VERSION, foo: "bar" };
    const result = validateSpecVersion(payload);
    expect(result).toBe(payload);
    expect(result.version).toBe(CURRENT_VERSION);
  });

  test("accepts every supported major at minor=0", () => {
    for (const major of SUPPORTED_MAJORS) {
      const payload = { version: `${major}.0` };
      expect(() => validateSpecVersion(payload)).not.toThrow();
    }
  });

  test("accepts unknown minor versions (additive evolution)", () => {
    const future = { version: "1.99" };
    expect(() => validateSpecVersion(future)).not.toThrow();
  });

  test("rejects missing version", () => {
    expect(() => validateSpecVersion({})).toThrow(/missing a recognizable `version` field/);
  });

  test("rejects null version", () => {
    expect(() => validateSpecVersion({ version: null })).toThrow(/missing a recognizable/);
  });

  test("rejects malformed version string", () => {
    expect(() => validateSpecVersion({ version: "latest" })).toThrow(/missing a recognizable/);
    expect(() => validateSpecVersion({ version: "v1.0" })).toThrow(/missing a recognizable/);
  });

  test("rejects unsupported major with clear guidance", () => {
    expect(() => validateSpecVersion({ version: "99.0" })).toThrow(/unrecognized major version/);
    expect(() => validateSpecVersion({ version: "99.0" })).toThrow(/upgrade the JS bundle/);
  });

  test("error message includes the context label", () => {
    expect(() => validateSpecVersion({}, "SplitForestPayload")).toThrow(/SplitForestPayload/);
  });
});

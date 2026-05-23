import { describe, it, expect } from "bun:test";
import { SCHEMA_REGISTRY } from "./columns";
import { GLYPHS, type GlyphToken } from "../lib/ui-glyphs";
import { schemaGlyph, slotGlyphFor, FIELD_CATEGORY_GLYPH } from "./glyph-utils";

describe("schema glyphs", () => {
  it("every concrete schema declares a glyph", () => {
    for (const [key, schema] of Object.entries(SCHEMA_REGISTRY)) {
      if (schema.abstract) continue;
      expect(schema.glyph, `concrete schema ${key} missing glyph`).toBeTruthy();
    }
  });

  it("every declared glyph resolves to a known token", () => {
    for (const [key, schema] of Object.entries(SCHEMA_REGISTRY)) {
      if (!schema.glyph) continue;
      expect(schema.glyph in GLYPHS, `schema ${key} glyph ${schema.glyph} not in table`).toBe(true);
    }
  });

  it("schemaGlyph walks inheritance for abstract-only declarations", () => {
    // viz_boxplot declares its own glyph; that should take precedence.
    expect(schemaGlyph(SCHEMA_REGISTRY.viz_boxplot, SCHEMA_REGISTRY)).toBe("type.boxplot");
    // viz declares "type.viz"; viz-derived schemas without their own
    // glyph would fall back to viz — but every viz_* declares its own.
    expect(schemaGlyph(SCHEMA_REGISTRY.viz, SCHEMA_REGISTRY)).toBe("type.viz");
  });

  it("schemaGlyph returns undefined for an abstract schema with no glyph chain", () => {
    expect(schemaGlyph(SCHEMA_REGISTRY.base, SCHEMA_REGISTRY)).toBeUndefined();
  });
});

describe("slot glyph derivation", () => {
  it("each FieldCategory maps to a known glyph (except 'other')", () => {
    for (const [cat, token] of Object.entries(FIELD_CATEGORY_GLYPH)) {
      if (cat === "other") {
        expect(token).toBeUndefined();
        continue;
      }
      expect(token, `category ${cat}`).toBeTruthy();
      expect(token! in GLYPHS, `category ${cat} → ${token} not in table`).toBe(true);
    }
  });

  it("slotGlyphFor picks the first category with a glyph", () => {
    expect(slotGlyphFor(["numeric", "integer"])).toBe("field.numeric");
    expect(slotGlyphFor(["string", "numeric"])).toBe("field.string");
    expect(slotGlyphFor(["date", "string"])).toBe("field.date");
    expect(slotGlyphFor(["array-numeric"])).toBe("field.array");
  });

  it("slotGlyphFor skips 'other' (no glyph) and picks the next", () => {
    expect(slotGlyphFor(["other", "string"])).toBe("field.string");
  });

  it("slotGlyphFor returns undefined when all accepted categories lack a glyph", () => {
    expect(slotGlyphFor(["other"])).toBeUndefined();
    expect(slotGlyphFor([])).toBeUndefined();
  });
});

describe("every schema slot is glyph-discoverable", () => {
  it("every concrete schema's slots resolve to a glyph (sanity)", () => {
    for (const [key, schema] of Object.entries(SCHEMA_REGISTRY)) {
      if (schema.abstract) continue;
      if (!schema.slots) continue;
      for (const slot of schema.slots) {
        const g = slotGlyphFor(slot.accepts);
        if (g === undefined) {
          // 'other'-only slots are allowed but suspicious — record so
          // future authors notice if they introduce one.
          const hasOnlyOther = slot.accepts.every((c) => c === "other");
          expect(hasOnlyOther, `${key}.${slot.key}: accepts [${slot.accepts.join(",")}] yields no glyph`).toBe(true);
        } else {
          expect(g in GLYPHS, `${key}.${slot.key} → ${g} not in table`).toBe(true);
        }
      }
    }
  });
});

#!/usr/bin/env node
//
// mcp-server.mjs — the LLM-driver path (roadmap area D, 2026-06-11).
//
// A minimal-but-real MCP (Model Context Protocol) server over stdio
// exposing tabviz's spec-first contract to LLM agents:
//
//   list_column_types  — the column roster
//   get_column_schema  — one type's full option schema (introspection)
//   list_themes        — the nine curated preset names
//   get_spec_schema    — the published JSON Schema (wire contract)
//   validate_spec      — structured {path, code, message} diagnostics
//   render_svg         — headless spec → SVG (the proof a spec works)
//
// Imports ONLY from dist/ — the server exercises exactly what an npm
// consumer gets (build with `npm run build:npm` first). Protocol is
// newline-delimited JSON-RPC 2.0 (the MCP stdio transport); deliberately
// hand-rolled to keep the published surface dependency-free.
//
// Register in Claude Code:
//   claude mcp add tabviz -- node <repo>/srcjs/scripts/mcp-server.mjs
// Smoke-test: node scripts/mcp-smoke.mjs

import { readFileSync } from "fs";
import { createInterface } from "readline";
import {
  listColumnTypes, columnSchema,
  themeNejm, themeLedger, themeBrutalist, themeAurora, themeTerminal,
  themeNewsprint, themeBlueprint, themeSynthwave, themeDwarven,
} from "../dist/index.mjs";
import { validateSpec } from "../dist/spec.mjs";
import { exportToSVG } from "../dist/export.mjs";

const SCHEMA_PATH = new URL("../dist/tabviz-spec.schema.json", import.meta.url);
const THEMES = {
  nejm: themeNejm, ledger: themeLedger, brutalist: themeBrutalist,
  aurora: themeAurora, terminal: themeTerminal, newsprint: themeNewsprint,
  blueprint: themeBlueprint, synthwave: themeSynthwave, dwarven: themeDwarven,
};

const TOOLS = [
  {
    name: "list_column_types",
    description:
      "List every tabviz column type (text, numeric, forest, pvalue, sparkline, …) with one-line labels. Start here when authoring a spec.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_column_schema",
    description:
      "Full option schema for one column type: every option's key, control, default, bounds, and allowed values. Use before writing a column's `options` block.",
    inputSchema: {
      type: "object",
      properties: { type: { type: "string", description: "Column type key, e.g. \"numeric\"" } },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "list_themes",
    description: "List the nine curated theme presets usable as `theme: \"<name>\"` in a spec.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_spec_schema",
    description:
      "The published JSON Schema (2020-12) for the tabviz wire spec — top-level shape plus per-column-type option definitions.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "validate_spec",
    description:
      "Structurally validate a wire spec. Returns {path, code, message, severity} diagnostics: version, data shape ({rows, groups} with per-row metadata), row/column id uniqueness, column types (typo detection against the live roster), field references. Empty array = valid.",
    inputSchema: {
      type: "object",
      properties: { spec: { type: "object", description: "The WebSpec wire payload" } },
      required: ["spec"],
      additionalProperties: false,
    },
  },
  {
    name: "render_svg",
    description:
      "Render a wire spec to SVG headlessly (the same engine the R package uses for export). The definitive check that a spec actually works — and the artifact itself. Theme may be a preset name string or a resolved theme object.",
    inputSchema: {
      type: "object",
      properties: { spec: { type: "object", description: "The WebSpec wire payload" } },
      required: ["spec"],
      additionalProperties: false,
    },
  },
];

function callTool(name, args) {
  switch (name) {
    case "list_column_types":
      return listColumnTypes();
    case "get_column_schema": {
      try {
        return columnSchema(args?.type);
      } catch {
        const known = listColumnTypes().map((t) => t.type).join(", ");
        throw new Error(`Unknown column type "${args?.type}". Known: ${known}`);
      }
    }
    case "list_themes":
      return Object.keys(THEMES);
    case "get_spec_schema":
      return JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    case "validate_spec": {
      // The typo roster must be WIRE types (listColumnTypes returns
      // AUTHORING keys, e.g. "viz_forest" whose wire type is "forest");
      // the published schema's column_* defs are exactly that roster.
      const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
      const knownTypes = Object.keys(schema.$defs ?? {})
        .filter((k) => k.startsWith("column_"))
        .map((k) => k.slice("column_".length));
      return validateSpec(args?.spec, { knownTypes });
    }
    case "render_svg": {
      const spec = { ...args?.spec };
      if (typeof spec.theme === "string") {
        const factory = THEMES[spec.theme];
        if (!factory) throw new Error(`Unknown theme "${spec.theme}". Known: ${Object.keys(THEMES).join(", ")}`);
        spec.theme = factory();
      }
      return exportToSVG(spec);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC 2.0 over newline-delimited stdio (MCP transport) ────────
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const replyError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return replyError(null, -32700, "Parse error"); }
  const { id, method, params } = req;
  try {
    switch (method) {
      case "initialize":
        return reply(id, {
          protocolVersion: params?.protocolVersion ?? "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "tabviz", version: "0.6.0" },
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return; // notifications take no response
      case "tools/list":
        return reply(id, { tools: TOOLS });
      case "tools/call": {
        const result = callTool(params?.name, params?.arguments ?? {});
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 1);
        return reply(id, { content: [{ type: "text", text }] });
      }
      case "ping":
        return reply(id, {});
      default:
        if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    // Tool errors surface as MCP tool results with isError (the agent can
    // read and self-correct), not protocol failures.
    if (method === "tools/call") {
      return reply(id, { content: [{ type: "text", text: String(e?.message ?? e) }], isError: true });
    }
    replyError(id, -32603, String(e?.message ?? e));
  }
});

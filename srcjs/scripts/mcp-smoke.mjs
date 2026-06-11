#!/usr/bin/env node
//
// mcp-smoke.mjs — drives mcp-server.mjs over REAL stdio (spawned child,
// newline-delimited JSON-RPC) through the full LLM-driver journey:
// initialize → tools/list → introspect → author → validate (bad spec
// gets structured diagnostics; good spec passes) → render_svg.
// Exits non-zero on any failure. Run after `npm run build:npm`.

import { spawn } from "child_process";
import { createInterface } from "readline";

const server = spawn(process.execPath, [new URL("./mcp-server.mjs", import.meta.url).pathname], {
  stdio: ["pipe", "pipe", "inherit"],
});
const pending = new Map();
let nextId = 1;

createInterface({ input: server.stdout }).on("line", (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  const resolver = pending.get(msg.id);
  if (resolver) {
    pending.delete(msg.id);
    resolver(msg);
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout: ${method}`)); } }, 15_000);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
const toolText = (resp) => resp.result?.content?.[0]?.text ?? "";

const checks = [];
const check = (label, ok, detail = "") => {
  checks.push([label, ok, detail]);
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : ` — ${detail}`}`);
};

try {
  // 1. Handshake
  const init = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
  check("initialize", init.result?.serverInfo?.name === "tabviz", JSON.stringify(init).slice(0, 120));
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  // 2. Tool roster
  const tools = await rpc("tools/list");
  const names = (tools.result?.tools ?? []).map((t) => t.name);
  check("tools/list exposes all six", ["list_column_types", "get_column_schema", "list_themes", "get_spec_schema", "validate_spec", "render_svg"].every((n) => names.includes(n)), names.join(","));

  // 3. Introspection
  const types = JSON.parse(toolText(await rpc("tools/call", { name: "list_column_types", arguments: {} })));
  check("column roster has viz_forest + numeric (authoring keys)", types.some((t) => t.type === "viz_forest") && types.some((t) => t.type === "numeric"));
  const numericSchema = JSON.parse(toolText(await rpc("tools/call", { name: "get_column_schema", arguments: { type: "numeric" } })));
  check("numeric schema lists options with controls", Array.isArray(numericSchema) && numericSchema.every((o) => o.option && o.control));
  const badType = await rpc("tools/call", { name: "get_column_schema", arguments: { type: "nope" } });
  check("unknown type → isError with roster", badType.result?.isError === true && toolText(badType).includes("forest"));
  const themes = JSON.parse(toolText(await rpc("tools/call", { name: "list_themes", arguments: {} })));
  check("nine themes", themes.length === 9 && themes.includes("nejm"));
  const schema = JSON.parse(toolText(await rpc("tools/call", { name: "get_spec_schema", arguments: {} })));
  check("JSON schema has column defs", Object.keys(schema.$defs ?? {}).some((k) => k.startsWith("column_")));

  // 4. Validate — broken spec gets structured diagnostics
  const badSpec = { version: "1.10", data: { rows: [{ id: "r1", label: "A", metadata: { x: 1 } }], groups: [] }, columns: [{ id: "c1", type: "numerc", field: "ghost" }] };
  const issues = JSON.parse(toolText(await rpc("tools/call", { name: "validate_spec", arguments: { spec: badSpec } })));
  check("typo'd type + ghost field diagnosed",
    issues.some((i) => i.code === "unknown-type") && issues.some((i) => i.code === "unknown-ref"),
    JSON.stringify(issues));

  // 5. Author a good spec by hand (the LLM path: schema-guided authoring)
  const goodSpec = {
    version: "1.10",
    data: {
      rows: [
        { id: "r1", label: "Anderson 2020", metadata: { study: "Anderson 2020", n: 245, hr: 0.72, lo: 0.58, hi: 0.89 } },
        { id: "r2", label: "Baker 2021", metadata: { study: "Baker 2021", n: 189, hr: 0.81, lo: 0.63, hi: 1.04 } },
      ],
      groups: [],
    },
    columns: [
      { id: "c1", type: "text", field: "study", header: "Study" },
      { id: "c2", type: "numeric", field: "n", header: "N", options: { numeric: { decimals: 0 } } },
      { id: "c3", type: "forest", field: "_f", header: "HR", options: { forest: { point: "hr", lower: "lo", upper: "hi" } } },
    ],
    labels: { title: "MCP smoke" },
    theme: "nejm",
  };
  const goodIssues = JSON.parse(toolText(await rpc("tools/call", { name: "validate_spec", arguments: { spec: goodSpec } })));
  check("hand-authored spec validates clean", goodIssues.length === 0, JSON.stringify(goodIssues));

  // 6. Render
  const svgResp = await rpc("tools/call", { name: "render_svg", arguments: { spec: goodSpec } });
  const svg = toolText(svgResp);
  check("render_svg produces SVG with the data", !svgResp.result?.isError && svg.includes("<svg") && svg.includes("Anderson 2020"), svg.slice(0, 120));
} catch (e) {
  check("smoke run completes", false, String(e));
}

server.kill();
const failed = checks.filter(([, ok]) => !ok).length;
if (failed) {
  console.error(`\n${failed} MCP smoke check(s) failed`);
  process.exit(1);
}
console.log(`\nMCP smoke passed: ${checks.length} checks across the full driver journey.`);

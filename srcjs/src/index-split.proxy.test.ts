import { describe, test, expect, mock } from "bun:test";
import { splitProxyMethods } from "./index-split.svelte";

// Minimal fake split store — splitProxyMethods only touches selectSpec.
function makeFakeSplitStore() {
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (method: string) =>
    mock((...args: unknown[]) => { calls.push({ method, args }); });
  return {
    calls,
    selectSpec: record("selectSpec"),
  };
}

function dispatch(
  method: string,
  args: Record<string, unknown>,
  store: ReturnType<typeof makeFakeSplitStore>,
) {
  const handler = splitProxyMethods[method];
  if (!handler) throw new Error(`no handler for ${method}`);
  handler(store as unknown as Parameters<typeof handler>[0], args);
}

describe("splitProxyMethods dispatch", () => {
  test("selectPlot routes to selectSpec with proxy source tag", () => {
    const s = makeFakeSplitStore();
    dispatch("selectPlot", { key: "pane_a" }, s);
    const entry = (s.calls as { method: string; args: unknown[] }[])[0];
    expect(entry.method).toBe("selectSpec");
    expect(entry.args).toEqual(["pane_a", "proxy"]);
  });

  test("selectPlot with non-string key is rejected (no-op)", () => {
    const s = makeFakeSplitStore();
    dispatch("selectPlot", { key: 42 }, s);
    expect((s.calls as unknown[]).length).toBe(0);
  });

  test("selectPlot with missing key is rejected", () => {
    const s = makeFakeSplitStore();
    dispatch("selectPlot", {}, s);
    expect((s.calls as unknown[]).length).toBe(0);
  });
});

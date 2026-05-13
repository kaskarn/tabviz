import { describe, test, expect, mock } from "bun:test";
import { createEventEmitter } from "./events.ts";

interface TestEvents {
  ping: string;
  count: number;
  done: undefined;
}

describe("createEventEmitter", () => {
  test("delivers typed payloads to subscribers", () => {
    const e = createEventEmitter<TestEvents>();
    const received: string[] = [];
    e.on("ping", (v) => received.push(v));
    e.emit("ping", "hello");
    e.emit("ping", "world");
    expect(received).toEqual(["hello", "world"]);
  });

  test("supports multiple subscribers per event", () => {
    const e = createEventEmitter<TestEvents>();
    const a = mock(() => {});
    const b = mock(() => {});
    e.on("count", a);
    e.on("count", b);
    e.emit("count", 7);
    expect(a).toHaveBeenCalledWith(7);
    expect(b).toHaveBeenCalledWith(7);
  });

  test("unsubscribe stops further deliveries", () => {
    const e = createEventEmitter<TestEvents>();
    let received = 0;
    const off = e.on("count", (v) => { received = v; });
    e.emit("count", 1);
    expect(received).toBe(1);
    off();
    e.emit("count", 99);
    expect(received).toBe(1); // unchanged
  });

  test("does not deliver to listeners on other events", () => {
    const e = createEventEmitter<TestEvents>();
    const pingListener = mock(() => {});
    e.on("ping", pingListener);
    e.emit("count", 42);
    expect(pingListener).not.toHaveBeenCalled();
  });

  test("a throwing listener doesn't block the others", () => {
    const e = createEventEmitter<TestEvents>();
    const aftermath = mock(() => {});
    e.on("ping", () => { throw new Error("nope"); });
    e.on("ping", aftermath);
    // Suppress the console.error so test output stays clean.
    const orig = console.error;
    console.error = () => {};
    try {
      e.emit("ping", "x");
    } finally {
      console.error = orig;
    }
    expect(aftermath).toHaveBeenCalledWith("x");
  });

  test("a listener can unsubscribe itself during emit", () => {
    const e = createEventEmitter<TestEvents>();
    const received: string[] = [];
    let off: () => void;
    off = e.on("ping", (v) => {
      received.push(v);
      off!();
    });
    e.on("ping", (v) => received.push(`after-${v}`));
    e.emit("ping", "a");
    e.emit("ping", "b");
    // First emit: both listeners run, self-unsubscribed one removes itself
    // Second emit: only the after-listener runs
    expect(received).toEqual(["a", "after-a", "after-b"]);
  });

  test("destroy() clears every listener", () => {
    const e = createEventEmitter<TestEvents>();
    const listener = mock(() => {});
    e.on("ping", listener);
    e.destroy();
    e.emit("ping", "x");
    expect(listener).not.toHaveBeenCalled();
  });

  test("undefined-payload events work", () => {
    const e = createEventEmitter<TestEvents>();
    const listener = mock(() => {});
    e.on("done", listener);
    e.emit("done", undefined);
    expect(listener).toHaveBeenCalledWith(undefined);
  });
});

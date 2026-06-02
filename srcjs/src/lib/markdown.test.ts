import { describe, test, expect } from "bun:test";
import { renderMarkdown, markdownToPlainText } from "./markdown";

describe("renderMarkdown — safety", () => {
  test("escapes raw HTML (no injection)", () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  test("escapes HTML inside emphasis", () => {
    expect(renderMarkdown("**<script>**")).toBe("<p><strong>&lt;script&gt;</strong></p>");
  });

  test("drops non-http(s)/mailto link schemes (javascript:)", () => {
    const out = renderMarkdown("[click](javascript:alert(1))");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("click"); // link text kept as plain text
  });

  test("keeps http/https/mailto links with noopener", () => {
    const out = renderMarkdown("[site](https://example.com)");
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe("renderMarkdown — formatting", () => {
  test("headings", () => {
    expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>");
    expect(renderMarkdown("### Small")).toBe("<h3>Small</h3>");
  });

  test("bold + italic + inline code", () => {
    expect(renderMarkdown("**b** *i* `c`")).toBe("<p><strong>b</strong> <em>i</em> <code>c</code></p>");
  });

  test("unordered + ordered lists", () => {
    expect(renderMarkdown("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(renderMarkdown("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  test("paragraphs separated by blank line; single newline → <br>", () => {
    expect(renderMarkdown("one\ntwo\n\nthree")).toBe("<p>one<br>two</p><p>three</p>");
  });

  test("empty input → empty string", () => {
    expect(renderMarkdown("")).toBe("");
  });
});

describe("markdownToPlainText (SVG export)", () => {
  test("strips emphasis/heading/code markers", () => {
    expect(markdownToPlainText("# H")).toBe("H");
    expect(markdownToPlainText("**b** *i* `c`")).toBe("b i c");
  });

  test("unordered list → bullets; ordered list keeps numbers", () => {
    expect(markdownToPlainText("- a\n- b")).toBe("• a\n• b");
    expect(markdownToPlainText("1. a\n2. b")).toBe("1. a\n2. b");
  });

  test("links → their label", () => {
    expect(markdownToPlainText("see [docs](https://e.com)")).toBe("see docs");
  });

  test("preserves line structure (no HTML)", () => {
    const out = markdownToPlainText("one\ntwo");
    expect(out).toBe("one\ntwo");
    expect(out).not.toContain("<");
  });
});

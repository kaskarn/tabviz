/**
 * Minimal, safe markdown → HTML for details/disclosure panels.
 *
 * Deliberately tiny and **safe-by-construction**: the input is HTML-escaped
 * FIRST, then a small, fixed set of markdown constructs is re-introduced as
 * known-good tags. No raw HTML passes through — so author/data-supplied panel
 * content can't inject markup. (If richer content is ever needed, that's a
 * separate, explicitly-opt-in path — not a widening of this renderer.)
 *
 * Supported: headings (#, ##, ###), bold, italic (single * or _), inline `code`,
 * links [text](url) (http/https/mailto only), unordered (-, *) and ordered (1.)
 * lists, paragraphs + line breaks. Everything else renders as escaped text.
 *
 * Pure, no DOM — bun-testable; runs in V8 too.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Safe href: only http(s)/mailto, else dropped. Applied to already-escaped text. */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h;
  return null;
}

/** Inline spans on an already-escaped line: code, links, bold, italic. */
function renderInline(escaped: string): string {
  let s = escaped;
  // inline code first (so its contents aren't further formatted)
  s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  // links [text](url) — text/url already escaped; validate scheme
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const href = safeHref(url);
    return href
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
      : text;
  });
  // bold **x**, then italic *x* / _x_
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  return s;
}

/**
 * Render a markdown string to a safe HTML string. Block-level: headings, lists,
 * and paragraphs separated by blank lines; single newlines become `<br>`.
 */
export function renderMarkdown(md: string): string {
  if (!md) return "";
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const flushList = (ordered: boolean, items: string[]) => {
    if (items.length === 0) return;
    const tag = ordered ? "ol" : "ul";
    out.push(`<${tag}>${items.map((it) => `<li>${renderInline(escapeHtml(it))}</li>`).join("")}</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    // blank line — paragraph separator
    if (line.trim() === "") { i++; continue; }

    // heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(escapeHtml(h[2]))}</h${level}>`);
      i++;
      continue;
    }

    // unordered list block
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      flushList(false, items);
      continue;
    }

    // ordered list block
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      flushList(true, items);
      continue;
    }

    // paragraph: consecutive non-blank, non-block lines joined by <br>
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(renderInline(escapeHtml(lines[i])));
      i++;
    }
    out.push(`<p>${para.join("<br>")}</p>`);
  }

  return out.join("");
}

/**
 * Strip markdown to plain text for the SVG/V8 export (which renders `<text>`,
 * not HTML). Removes emphasis/heading/code markers, turns links into their
 * label, and unordered list items into "• item"; preserves line structure as
 * newlines so the export's text wrapper can lay it out. Pure.
 */
export function markdownToPlainText(md: string): string {
  if (!md) return "";
  return md
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      let s = line;
      s = s.replace(/^(#{1,3})\s+/, "");               // heading marker
      s = s.replace(/^\s*[-*]\s+/, "• ");          // unordered list → bullet
      s = s.replace(/^\s*(\d+)\.\s+/, "$1. ");           // ordered list (keep number)
      s = s.replace(/`([^`]+)`/g, "$1");                 // inline code
      s = s.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");   // links → text
      s = s.replace(/\*\*([^*]+)\*\*/g, "$1");           // bold
      s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1$2");     // italic *
      s = s.replace(/(^|[^_])_([^_]+)_/g, "$1$2");       // italic _
      return s;
    })
    .join("\n");
}

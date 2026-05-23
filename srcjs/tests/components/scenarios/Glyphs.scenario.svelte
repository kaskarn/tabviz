<!--
  Glyphs scenario — visual contact sheet for the UI glyph vocabulary.
  Not interactive. Lays out every glyph in its category so the
  designer (and visual regression) can audit the typographic palette
  the editor will use.

  Scenario also serves as the canonical reference: if you're adding a
  glyph to the table, mount this scenario first to see how it lands
  alongside its siblings.
-->
<script lang="ts">
  import { GLYPHS, type GlyphToken } from "../../../src/lib/ui-glyphs";

  type Row = { token: GlyphToken; suffix: string; value: string };
  type Group = { title: string; subtitle: string; rows: Row[] };

  function groupOf(prefix: string, title: string, subtitle: string): Group {
    const rows: Row[] = (Object.keys(GLYPHS) as GlyphToken[])
      .filter(k => k.startsWith(`${prefix}.`))
      .map(k => ({ token: k, suffix: k.slice(prefix.length + 1), value: GLYPHS[k] }));
    return { title, subtitle, rows };
  }

  const groups: Group[] = [
    groupOf("type",    "Column types",    "Editor header, picker, type badges"),
    groupOf("field",   "Field types",     "Data-source kind shown in field picker"),
    groupOf("align",   "Alignment",       "Segmented L / C / R / J"),
    groupOf("density", "Density",         "Spacing presets — ⫶ / ⫶⫶ / ⫶⫶⫶"),
    groupOf("sort",    "Sort",            "Header sort indicator state"),
    groupOf("action",  "Actions",         "Buttons in editor + table chrome"),
    groupOf("section", "Section flags",   "Accordion / section heading badges"),
    groupOf("mode",    "MappedValue mode","Theme / static / field / condition selector"),
    groupOf("status",  "Status",          "Inline validation + bank state"),
  ];
</script>

<div class="sheet">
  {#each groups as g (g.title)}
    <section class="group">
      <header class="group-h">
        <h2 class="group-title">{g.title}</h2>
        <span class="group-sub">{g.subtitle}</span>
        <span class="group-count">{g.rows.length}</span>
      </header>
      <div class="cards">
        {#each g.rows as r (r.token)}
          <div class="card" title={r.token}>
            <div class="card-glyph">{r.value}</div>
            <div class="card-label">{r.suffix}</div>
            <div class="card-token">{r.token}</div>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 720px;
    max-width: 100%;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .group-h {
    display: flex;
    align-items: baseline;
    gap: 10px;
    border-bottom: 1px solid var(--tv-divider, #d6d2c6);
    padding-bottom: 6px;
  }
  .group-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .group-sub {
    color: var(--tv-text-muted, #7a7466);
    font-size: 11px;
  }
  .group-count {
    margin-left: auto;
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 10px;
    color: var(--tv-text-muted, #7a7466);
    background: rgba(0,0,0,0.04);
    border-radius: 3px;
    padding: 1px 6px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 6px;
  }
  .card {
    display: grid;
    grid-template-rows: 36px auto auto;
    align-items: center;
    justify-items: center;
    background: #ffffff;
    border: 1px solid var(--tv-divider, #d6d2c6);
    border-radius: 4px;
    padding: 8px 6px 6px;
    cursor: default;
    transition: border-color 100ms;
  }
  .card:hover { border-color: var(--tv-ink, #1c1a14); }
  .card-glyph {
    font-size: 22px;
    line-height: 1;
    color: var(--tv-ink, #1c1a14);
    font-feature-settings: "tnum", "kern";
  }
  .card-label {
    font-size: 10px;
    color: var(--tv-ink, #1c1a14);
    font-weight: 500;
    margin-top: 4px;
  }
  .card-token {
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 8.5px;
    color: var(--tv-text-muted, #7a7466);
    margin-top: 1px;
    letter-spacing: 0.02em;
  }
</style>

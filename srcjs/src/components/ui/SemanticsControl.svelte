<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { SemanticBundle, Semantics } from "$types";
  import SettingsSection from "./SettingsSection.svelte";
  import OptionalField from "./OptionalField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const semantics = $derived(store.spec?.theme?.semantics as Semantics | undefined);
  const themeColors = $derived(store.spec?.theme?.colors);
  const typography = $derived(store.spec?.theme?.typography);

  // Per-token ordering in the UI. Matches the precedence in semantic-styling.ts
  // (accent > emphasis > muted) — users reading top-to-bottom see "strongest
  // intent first."
  const tokens = ["accent", "emphasis", "muted"] as const;
  type Token = typeof tokens[number];

  const tokenDescriptions: Record<Token, string> = {
    accent:   "Rows flagged as accent (highlight, call-out).",
    emphasis: "Rows flagged as emphasized (stand out from the stream).",
    muted:    "Rows flagged as muted (de-emphasized, footer-ish).",
  };

  /**
   * Count how many rows currently carry each semantic flag (via the R spec
   * or via in-widget paint). Users repeatedly reported "changing semantic
   * settings doesn't do anything" when no rows were flagged with the token
   * they were editing — the bundle edits ARE applying, there's just nothing
   * on screen to apply them to. Surface this explicitly so the no-op state
   * reads as "no targets" rather than "control is broken."
   */
  const tokenCounts = $derived.by(() => {
    const out: Record<Token, number> = { accent: 0, emphasis: 0, muted: 0 };
    const rows = store.spec?.data?.rows ?? [];
    for (const r of rows) {
      for (const tok of tokens) {
        if (store.getRowSemantic(r, tok)) out[tok]++;
      }
    }
    return out;
  });

  /**
   * Sensible "just turned off inherit" default for each field. When the user
   * unticks Inherit on a previously-null field, we need SOMETHING to commit
   * as the initial explicit value. These defaults lean on the current theme
   * so the first click produces a value that looks reasonable against the
   * active palette.
   */
  function inheritOffDefault(field: keyof SemanticBundle): string | number {
    switch (field) {
      case "fg":         return themeColors?.foreground ?? "#333333";
      case "bg":         return themeColors?.altBg ?? "#f8fafc";
      case "border":     return themeColors?.border ?? "#e2e8f0";
      case "markerFill": return themeColors?.accent ?? "#8b5cf6";
      case "fontWeight": return typography?.fontWeightBold ?? 600;
      case "fontStyle":  return "normal";
    }
  }

  function setField(token: Token, field: keyof SemanticBundle, value: unknown) {
    store.setSemanticField(token, field, value);
  }

  function toggleInherit(token: Token, field: keyof SemanticBundle, inherit: boolean) {
    if (inherit) {
      setField(token, field, null);
    } else {
      setField(token, field, inheritOffDefault(field));
    }
  }

  /**
   * Normalize a color value into a 6-digit hex for the native `<input type="color">`.
   * Mirrors `ColorField`'s helper — repeated here to keep SemanticsControl
   * self-contained.
   */
  function normalizeForPicker(v: string | null | undefined): string {
    if (!v) return "#000000";
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
    return "#000000";
  }
</script>

{#if semantics}
  {#each tokens as token (token)}
    {@const bundle = semantics[token]}
    {@const count = tokenCounts[token]}
    <SettingsSection
      title={`${token[0].toUpperCase() + token.slice(1)} ${count > 0 ? `(${count})` : ""}`}
      description={count > 0
        ? tokenDescriptions[token]
        : `${tokenDescriptions[token]} No rows currently flagged — use the paint tool or row_${token} in R.`}
    >
      <!-- FG / BG / BORDER / MARKER FILL ─────────────────────────────── -->
      {#each ([
        ["fg",         "Foreground",   "Text color"],
        ["bg",         "Background",   "Row / cell bg"],
        ["border",     "Border",       "Row bottom border"],
        ["markerFill", "Marker fill",  "Forest / bar / box / violin fill"],
      ] as const) as [key, label, hint] (key)}
        <OptionalField
          {label}
          {hint}
          inherit={bundle[key] == null}
          onchange={(inh) => toggleInherit(token, key, inh)}
        >
          {#snippet children()}
            <div class="color-input">
              <label class="swatch" style:background={(bundle[key] as string) ?? "#000"}>
                <input
                  class="picker"
                  type="color"
                  value={normalizeForPicker(bundle[key] as string | null)}
                  oninput={(e) => setField(token, key, (e.target as HTMLInputElement).value)}
                  aria-label="{label} color"
                />
              </label>
              <input
                class="hex"
                type="text"
                value={(bundle[key] as string) ?? ""}
                oninput={(e) => setField(token, key, (e.target as HTMLInputElement).value)}
                spellcheck="false"
                aria-label="{label} value"
              />
            </div>
          {/snippet}
        </OptionalField>
      {/each}

      <!-- FONT WEIGHT ──────────────────────────────────────────────────── -->
      <OptionalField
        label="Font weight"
        hint="100–900, step 100"
        inherit={bundle.fontWeight == null}
        onchange={(inh) => toggleInherit(token, "fontWeight", inh)}
      >
        {#snippet children()}
          <div class="weight-input">
            <input
              type="range"
              min={100}
              max={900}
              step={100}
              value={bundle.fontWeight ?? 400}
              oninput={(e) => setField(token, "fontWeight", parseInt((e.target as HTMLInputElement).value, 10))}
              aria-label="Font weight"
            />
            <span class="value">{bundle.fontWeight ?? 400}</span>
          </div>
        {/snippet}
      </OptionalField>

      <!-- FONT STYLE ───────────────────────────────────────────────────── -->
      <OptionalField
        label="Font style"
        inherit={bundle.fontStyle == null}
        onchange={(inh) => toggleInherit(token, "fontStyle", inh)}
      >
        {#snippet children()}
          <div class="segmented" role="radiogroup" aria-label="Font style">
            {#each ["normal", "italic"] as opt (opt)}
              <button
                type="button"
                role="radio"
                aria-checked={bundle.fontStyle === opt}
                class:selected={bundle.fontStyle === opt}
                onclick={() => setField(token, "fontStyle", opt)}
              >{opt === "normal" ? "Normal" : "Italic"}</button>
            {/each}
          </div>
        {/snippet}
      </OptionalField>
    </SettingsSection>
  {/each}
{/if}

<style>
  .color-input {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .swatch {
    position: relative;
    display: inline-block;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    border: 1px solid color-mix(in srgb, var(--wf-fg, #1a1a1a) 15%, transparent);
    background-image:
      linear-gradient(45deg, #eee 25%, transparent 25%),
      linear-gradient(-45deg, #eee 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #eee 75%),
      linear-gradient(-45deg, transparent 75%, #eee 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    cursor: pointer;
    overflow: hidden;
  }

  .swatch::after {
    content: "";
    position: absolute;
    inset: 0;
    background: inherit;
    background-image: none;
  }

  .picker {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .hex {
    width: 86px;
    padding: 3px 6px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 12%, var(--wf-border, #e2e8f0));
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    text-align: center;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    outline: none;
  }

  .hex:focus {
    border-color: var(--wf-primary, #2563eb);
  }

  .weight-input {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .weight-input input[type="range"] {
    width: 90px;
    accent-color: var(--wf-primary, #2563eb);
  }

  .weight-input .value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    min-width: 2.5em;
    text-align: right;
    color: var(--wf-fg, #1a1a1a);
  }

  .segmented {
    display: inline-flex;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 6px;
    overflow: hidden;
  }

  .segmented button {
    padding: 3px 10px;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--wf-fg, #1a1a1a);
    cursor: pointer;
  }

  .segmented button + button {
    border-left: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 10%, var(--wf-border, #e2e8f0));
  }

  .segmented button.selected {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 92%, transparent);
    color: var(--wf-bg, #ffffff);
  }
</style>

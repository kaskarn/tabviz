<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { WebTheme } from "$types";
  import { THEME_NAMES, THEME_LABELS, type ThemeName } from "$lib/theme-presets";
  import { autoPosition } from "$lib/dropdown-position";
  import Portal from "$lib/Portal.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  // The wire shape from R supports two forms:
  // * Flat:        Record<string, WebTheme>
  // * Categorized: Record<string, Record<string, WebTheme>>
  // The categorized form makes each top-level key a tab label in the dropdown.
  // Flat form renders the dropdown without tabs (no visual hierarchy needed
  // for a small set of themes).
  type FlatThemes = Record<string, WebTheme>;
  type CategorizedThemes = Record<string, Record<string, WebTheme>>;
  type ThemesInput = FlatThemes | CategorizedThemes;

  interface Props {
    store: ForestStore;
    availableThemes?: ThemesInput | null;  // undefined = all built-ins, null = hidden
    /**
     * Notification fired when the user picks a theme. Receives the theme key
     * AND the resolved WebTheme (when available via `availableThemes`). The
     * resolved object lets parents like the split forest persist the v2 theme
     * across leaves; the name alone is insufficient since the local
     * `THEME_PRESETS` fallback is v1-shaped and crashes the v2 renderer.
     */
    onThemeChange?: (themeName: ThemeName, theme?: WebTheme) => void;
  }

  let { store, availableThemes, onThemeChange }: Props = $props();

  let dropdownOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);

  const currentTheme = $derived(store.spec?.theme?.name ?? "default");

  // Detect categorized vs flat. A v2 WebTheme always carries `schemaVersion`
  // on the wire; a category sub-object never does. (Falls back to a
  // structural check — has the inner value `surface` / `name` properties? —
  // for resilience against future wire-shape tweaks.)
  function isThemeShaped(v: unknown): v is WebTheme {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return "schemaVersion" in o || "surface" in o || "colors" in o;
  }
  const categorized = $derived.by((): boolean => {
    if (!availableThemes) return false;
    const first = Object.values(availableThemes)[0];
    return !!first && typeof first === "object" && !isThemeShaped(first);
  });

  // Active tab index when categorized. Reset to 0 when the categorization
  // shape flips (e.g. user swaps spec).
  let activeCategoryIdx = $state(0);
  $effect(() => {
    void availableThemes;
    activeCategoryIdx = 0;
  });

  // Tab strip labels (categorized only).
  const categories = $derived.by((): string[] => {
    if (!categorized || !availableThemes) return [];
    return Object.keys(availableThemes);
  });

  // Theme entries to render below the tab strip — filtered to the active
  // category when categorized, full list otherwise.
  const themeEntries = $derived.by((): [string, string][] => {
    if (availableThemes === undefined || availableThemes === null) {
      // Use all preset names (built-in fallback).
      return THEME_NAMES.map(name => [name, THEME_LABELS[name]]);
    }
    if (categorized) {
      const catName = categories[activeCategoryIdx] ?? categories[0];
      const themesInCat = (availableThemes as CategorizedThemes)[catName] ?? {};
      return Object.entries(themesInCat).map(([key, theme]) => {
        const label = theme.name
          ? (THEME_LABELS[theme.name as ThemeName] ?? theme.name)
          : key;
        return [key, label];
      });
    }
    return Object.entries(availableThemes as FlatThemes).map(([key, theme]) => {
      const label = theme.name
        ? (THEME_LABELS[theme.name as ThemeName] ?? theme.name)
        : key;
      return [key, label];
    });
  });

  // Locate a theme across the wire-shape (handles both flat and categorized).
  function lookupTheme(name: string): WebTheme | undefined {
    if (!availableThemes) return undefined;
    if (categorized) {
      for (const cat of Object.values(availableThemes as CategorizedThemes)) {
        if (name in cat) return cat[name];
      }
      return undefined;
    }
    return (availableThemes as FlatThemes)[name];
  }

  // Extract identity pair + bg/fg for a theme so the dropdown row can
  // show a four-band color preview alongside the label. The identity pair
  // mirrors up the chain (secondary→primary) so for mono themes the two
  // bands collapse to identical color — that's expected and correctly
  // reflects the theme's chosen identity character. Falls back to muted
  // neutrals when a theme doesn't carry resolved values.
  function themeColors(name: string): {
    primary: string; secondary: string;
    accent: string; background: string; foreground: string;
  } {
    const t = lookupTheme(name);
    const inputs = t?.inputs ?? {};
    const primary    = inputs.primary    ?? t?.surface?.base    ?? "#cbd5e1";
    const secondary  = inputs.secondary  ?? primary;
    const accent     = inputs.accent     ?? "#94a3b8";
    const background = t?.surface?.base    ?? "#ffffff";
    const foreground = t?.content?.primary ?? "#1a1a1a";
    return { primary, secondary, accent, background, foreground };
  }

  // Theme name renders in the theme's own display face when available, so
  // the dropdown advertises typographic flavor at a glance. fontDisplay
  // takes precedence over fontBody (more characterful for headings) and
  // both fall through to the host --tv-font-family CSS var.
  function fontFor(name: string): string | undefined {
    const t = lookupTheme(name);
    return t?.inputs?.fontDisplay ?? t?.inputs?.fontBody ?? undefined;
  }

  // Eager-load every available theme's web fonts so previews don't flash
  // bare fallbacks on first dropdown open. Same dedup pattern as the per-
  // theme injector in ForestPlot.svelte (key by URL, append <link> once).
  $effect(() => {
    if (typeof document === "undefined" || !availableThemes) return;
    const themes: WebTheme[] = categorized
      ? Object.values(availableThemes as CategorizedThemes).flatMap(cat => Object.values(cat))
      : Object.values(availableThemes as FlatThemes);
    for (const t of themes) {
      const fonts = t?.webFonts;
      if (!Array.isArray(fonts) || fonts.length === 0) continue;
      for (const wf of fonts) {
        if (!wf?.url || typeof wf.url !== "string") continue;
        const safeUrl = wf.url.replace(/"/g, "");
        if (document.querySelector(`link[rel="stylesheet"][href="${safeUrl}"]`)) continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = wf.url;
        link.dataset.tabvizWebfont = wf.family;
        document.head.appendChild(link);
      }
    }
  });

  function closeDropdown() {
    dropdownOpen = false;
  }

  let pendingTheme = $state<string | null>(null);

  function applyTheme(themeName: string) {
    // Prefer the v2 wire-shape theme from availableThemes when present.
    // This works in both single and split mode (each store's setThemeObject
    // accepts a v2 WebTheme). The `onThemeChange` notification still fires
    // so split-mode parents can persist the choice across leaves.
    const theme = lookupTheme(themeName);
    if (theme && store.spec) {
      store.setThemeObject(theme);
      onThemeChange?.(themeName as ThemeName, theme);
      return;
    }
    // No matching v2 theme registered. Hand off to the parent (split mode)
    // or fall back to the local preset path (single mode without
    // availableThemes — typically dev-only since R always serializes v2).
    if (onThemeChange) {
      onThemeChange(themeName as ThemeName);
      return;
    }
    store.setTheme(themeName as ThemeName);
  }

  function selectTheme(themeName: string) {
    if (store.hasThemeEdits) {
      pendingTheme = themeName;
      closeDropdown();
      return;
    }
    applyTheme(themeName);
    closeDropdown();
  }

  function confirmPendingSwap() {
    if (pendingTheme !== null) {
      const target = pendingTheme;
      applyTheme(target);
      queueMicrotask(() => {
        pendingTheme = null;
      });
    }
  }

  function cancelPendingSwap() {
    pendingTheme = null;
  }

  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest(".theme-switcher-wrapper") || target.closest(".theme-dropdown")) {
      return;
    }
    closeDropdown();
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="theme-switcher-wrapper">
  <button
    bind:this={triggerEl}
    class="theme-btn"
    onclick={() => (dropdownOpen = !dropdownOpen)}
    aria-label="Switch theme"
    aria-expanded={dropdownOpen}
    data-tooltip="Switch theme"
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  </button>

  {#if dropdownOpen}
    <Portal>
      <div class="theme-dropdown" use:autoPosition={{ triggerEl }}>
        {#if categorized && categories.length > 1}
          <div class="tab-strip" role="tablist" aria-label="Theme categories">
            {#each categories as cat, i}
              <button
                type="button"
                role="tab"
                class="tab"
                class:active={i === activeCategoryIdx}
                aria-selected={i === activeCategoryIdx}
                onclick={() => (activeCategoryIdx = i)}
              >{cat}</button>
            {/each}
          </div>
        {/if}
        {#each themeEntries as [themeName, label]}
          {@const colors = themeColors(themeName)}
          <button
            class="dropdown-item"
            class:active={currentTheme === themeName}
            onclick={() => selectTheme(themeName)}
          >
            {#if currentTheme === themeName}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            {:else}
              <span class="spacer"></span>
            {/if}
            <span class="swatch-strip" aria-hidden="true">
              <span class="swatch" style:background={colors.primary}></span>
              <span class="swatch" style:background={colors.secondary}></span>
              <span class="swatch" style:background={colors.accent}></span>
              <span
                class="aa-tile"
                style:background={colors.background}
                style:color={colors.foreground}
                style:font-family={fontFor(themeName)}
              >Aa</span>
            </span>
            <span class="label" style:font-family={fontFor(themeName)}>{label}</span>
          </button>
        {/each}
      </div>
    </Portal>
  {/if}
</div>

<ConfirmDialog
  open={pendingTheme !== null}
  title="Discard theme edits?"
  message="Switching presets will reset your in-panel theme edits. Continue?"
  confirmLabel="Switch theme"
  cancelLabel="Keep editing"
  onconfirm={confirmPendingSwap}
  oncancel={cancelPendingSwap}
/>

<style>
  .theme-switcher-wrapper {
    position: relative;
  }

  .theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-text-muted, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .theme-btn:hover {
    background: var(--tv-border, #e2e8f0);
    color: var(--tv-fg, #1a1a1a);
  }

  .theme-dropdown {
    /* position: fixed set dynamically by autoPosition to escape clipping */
    min-width: 160px;
    padding: 4px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 10001;
  }

  .tab-strip {
    display: flex;
    gap: 2px;
    margin: 0 0 4px 0;
    padding: 0 0 4px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 8%, transparent);
  }
  .tab {
    appearance: none;
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--tv-text-muted, #64748b);
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  .tab:hover:not(.active) {
    background: color-mix(in srgb, var(--tv-fg, #1a1a1a) 6%, transparent);
    color: var(--tv-fg, #1a1a1a);
  }
  .tab.active {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 12%, transparent);
    color: var(--tv-accent, #2563eb);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--tv-fg, #1a1a1a);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .dropdown-item:hover {
    background: var(--tv-border, #f1f5f9);
  }

  .dropdown-item.active {
    color: var(--tv-accent, #2563eb);
    font-weight: 500;
  }

  .dropdown-item svg {
    flex-shrink: 0;
    color: var(--tv-accent, #2563eb);
  }

  .spacer {
    width: 14px;
    flex-shrink: 0;
  }

  /* Identity-pair + accent + 'Aa' contrast tile preview chip — two
     identity swatches (primary | secondary), then accent, followed by
     an "Aa" glyph rendered in the theme's foreground over its background
     in the theme's display face. Conveys color identity AND callout
     color AND text-on-bg contrast AND typographic flavor in a single
     compact chip. */
  .swatch-strip {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 18%, transparent);
  }
  .swatch {
    display: block;
    width: 8px;
    height: 14px;
  }
  .aa-tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 14px;
    padding: 0 3px;
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .dropdown-item .label {
    flex: 1;
    min-width: 0;
  }
</style>

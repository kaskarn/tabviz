<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { WebTheme } from "$types";
  import { THEME_NAMES, THEME_LABELS, THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
  import { autoPosition } from "$lib/dropdown-position";
  import Portal from "$lib/Portal.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  interface Props {
    store: ForestStore;
    availableThemes?: Record<string, WebTheme> | null;  // Custom themes to show (undefined = all, null = none)
    onThemeChange?: (themeName: ThemeName) => void;
  }

  let { store, availableThemes, onThemeChange }: Props = $props();

  let dropdownOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);

  const currentTheme = $derived(store.spec?.theme?.name ?? "default");

  // Determine which themes to show
  // If availableThemes is undefined, show all preset themes
  // If availableThemes is an object, show those themes
  const themeEntries = $derived.by((): [string, string][] => {
    if (availableThemes === undefined || availableThemes === null) {
      // Use all preset themes
      return THEME_NAMES.map(name => [name, THEME_LABELS[name]]);
    }
    // Use provided themes - get name from each theme object or use key
    return Object.entries(availableThemes).map(([key, theme]) => {
      const label = theme.name
        ? THEME_LABELS[theme.name as ThemeName] ?? theme.name
        : key;
      return [key, label];
    });
  });

  function closeDropdown() {
    dropdownOpen = false;
  }

  /**
   * Pending theme name when the user has triggered a swap but we're waiting
   * on confirmation because there are in-panel edits. Cleared on confirm
   * or cancel. `null` means no pending swap.
   */
  let pendingTheme = $state<string | null>(null);

  function applyTheme(themeName: string) {
    if (onThemeChange) {
      onThemeChange(themeName as ThemeName);
    } else if (availableThemes && themeName in availableThemes) {
      // Custom-theme path: apply the supplied WebTheme directly, preserving
      // interactive column/row edits that setSpec would wipe.
      const theme = availableThemes[themeName];
      if (store.spec) {
        store.setThemeObject(theme);
      }
    } else {
      // Default path: swap to a named preset.
      store.setTheme(themeName as ThemeName);
    }
  }

  function selectTheme(themeName: string) {
    // If there are in-panel theme edits, defer the swap and surface the
    // in-widget confirm dialog. Using window.confirm() here is not viable:
    // htmlwidget host environments (RStudio viewer, sandboxed iframes) often
    // auto-dismiss native dialogs, which would silently block every theme
    // swap while we waited on user input that never arrived.
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
      // Close the dialog on the next microtask so the theme swap has flushed
      // before the ConfirmDialog's portal unmounts. Closing synchronously in
      // the same frame as the store mutation used to leave the widget
      // showing the previous theme until the next unrelated rerender.
      queueMicrotask(() => {
        pendingTheme = null;
      });
    }
  }

  function cancelPendingSwap() {
    pendingTheme = null;
  }

  // Close dropdown when clicking outside. The popover is portaled to
  // document.body, so ".theme-switcher-wrapper" no longer contains it —
  // we also treat clicks inside the popover itself as "inside".
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
        {#each themeEntries as [themeName, label]}
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
            <span>{label}</span>
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
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 6px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .theme-btn:hover {
    background: var(--wf-border, #e2e8f0);
    color: var(--wf-fg, #1a1a1a);
  }

  .theme-dropdown {
    /* position: fixed set dynamically by autoPosition to escape clipping */
    min-width: 140px;
    padding: 4px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 10001;  /* High z-index to appear above everything */
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
    color: var(--wf-fg, #1a1a1a);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .dropdown-item:hover {
    background: var(--wf-border, #f1f5f9);
  }

  .dropdown-item.active {
    color: var(--wf-primary, #2563eb);
    font-weight: 500;
  }

  .dropdown-item svg {
    flex-shrink: 0;
    color: var(--wf-primary, #2563eb);
  }

  .spacer {
    width: 14px;
    flex-shrink: 0;
  }
</style>

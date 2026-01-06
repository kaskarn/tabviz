<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import { THEME_NAMES, THEME_LABELS, type ThemeName } from "$lib/theme-presets";

  interface Props {
    store: ForestStore;
    onThemeChange?: (themeName: ThemeName) => void;
  }

  let { store, onThemeChange }: Props = $props();

  let dropdownOpen = $state(false);

  const currentTheme = $derived(store.spec?.theme?.name ?? "default");

  function closeDropdown() {
    dropdownOpen = false;
  }

  function selectTheme(themeName: ThemeName) {
    if (onThemeChange) {
      onThemeChange(themeName);
    } else {
      store.setTheme(themeName);
    }
    closeDropdown();
  }

  // Close dropdown when clicking outside
  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".theme-switcher-wrapper")) {
      closeDropdown();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="theme-switcher-wrapper">
  <button
    class="theme-btn"
    onclick={() => (dropdownOpen = !dropdownOpen)}
    aria-label="Switch theme"
    aria-expanded={dropdownOpen}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  </button>

  {#if dropdownOpen}
    <div class="theme-dropdown">
      {#each THEME_NAMES as themeName}
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
          <span>{THEME_LABELS[themeName]}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .theme-switcher-wrapper {
    position: relative;
  }

  .theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
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
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 140px;
    padding: 4px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 101;
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

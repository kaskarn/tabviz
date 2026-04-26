<!--
  ConfirmDialog — in-widget replacement for `window.confirm()`.

  `window.confirm` is unreliable across htmlwidget host environments:
  RStudio viewer, some Quarto setups, and sandboxed iframes all auto-dismiss
  browser dialogs (or block them entirely), which silently short-circuits
  any "confirm to continue" flow. This component renders a styled dialog
  via <Portal> so it's immune to those restrictions and visually coherent
  with the rest of the widget.
-->
<script lang="ts">
  import Portal from "$lib/Portal.svelte";

  interface Props {
    /** Whether the dialog is visible. */
    open: boolean;
    /** Title shown at the top of the card. */
    title: string;
    /** Body text shown under the title. */
    message: string;
    /** Label for the primary/confirm action. */
    confirmLabel?: string;
    /** Label for the secondary/cancel action. */
    cancelLabel?: string;
    /**
     * Visual variant for the primary button. "danger" uses the theme's
     * foreground-on-destructive palette (for irreversible actions);
     * "primary" uses the standard primary color.
     */
    variant?: "primary" | "danger";
    /** Called when the user confirms. */
    onconfirm: () => void;
    /** Called when the user cancels (Esc, backdrop, Cancel button). */
    oncancel: () => void;
  }

  let {
    open,
    title,
    message,
    confirmLabel = "Continue",
    cancelLabel = "Cancel",
    variant = "primary",
    onconfirm,
    oncancel,
  }: Props = $props();

  let confirmRef = $state<HTMLButtonElement | null>(null);
  let lastFocused: Element | null = null;

  // Autofocus the primary action when the dialog opens (common accessible
  // pattern) and restore focus to the prior element on close.
  $effect(() => {
    if (open) {
      lastFocused = document.activeElement;
      queueMicrotask(() => confirmRef?.focus());
    } else if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
      lastFocused = null;
    }
  });

  /**
   * Guard against firing the action twice (double-click, Enter-while-clicking).
   * Once the user picks a choice, the dialog is considered "resolving" until
   * the parent flips `open` back to false. Any further clicks are ignored.
   */
  let resolving = $state(false);
  $effect(() => {
    // Reset the guard whenever the dialog is re-opened.
    if (open) resolving = false;
  });

  function handleConfirm() {
    if (resolving) return;
    resolving = true;
    onconfirm();
  }

  function handleCancel() {
    if (resolving) return;
    resolving = true;
    oncancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      handleCancel();
    } else if (e.key === "Enter") {
      e.stopPropagation();
      handleConfirm();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <Portal>
    <div class="confirm-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        class="modal-backdrop"
        aria-label="Cancel"
        tabindex="-1"
        onclick={handleCancel}
      ></button>

      <div class="modal-card">
        <h3>{title}</h3>
        <p class="message">{message}</p>
        <div class="actions">
          <button type="button" class="cancel-btn" onclick={handleCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            class="confirm-btn"
            class:danger={variant === "danger"}
            bind:this={confirmRef}
            onclick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </Portal>
{/if}

<style>
  .confirm-modal {
    position: fixed;
    inset: 0;
    z-index: 10060;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  /* Backdrop + card both get explicit z-index inside the fixed modal
     container so DOM-order-based paint ordering never loses to a
     host-page rule that accidentally pushes one above the other.
     Historically authors reported clicks missing the buttons — likely
     a host-page stylesheet raising the backdrop's stacking. */
  .modal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 1;
    border: none;
    padding: 0;
    background: color-mix(in srgb, #0f172a 35%, transparent);
    cursor: pointer;
    animation: backdrop-in 0.18s ease;
  }

  .modal-card {
    position: relative;
    z-index: 2;
    pointer-events: auto;
    width: min(420px, 100%);
    padding: 18px 20px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 15%, var(--tv-border, #e2e8f0));
    border-radius: 12px;
    box-shadow:
      0 24px 48px -12px color-mix(in srgb, #0f172a 35%, transparent),
      0 4px 12px -4px color-mix(in srgb, var(--tv-primary, #2563eb) 25%, transparent);
    animation: card-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes card-in {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to   { transform: translateY(0)   scale(1);    opacity: 1; }
  }

  h3 {
    margin: 0 0 6px 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--tv-fg, #1a1a1a);
  }

  .message {
    margin: 0 0 16px 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--tv-secondary, #64748b);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .cancel-btn,
  .confirm-btn {
    padding: 6px 14px;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .cancel-btn {
    border: 1px solid color-mix(in srgb, var(--tv-border, #e2e8f0) 80%, transparent);
    background: transparent;
    color: var(--tv-secondary, #64748b);
  }

  .cancel-btn:hover {
    color: var(--tv-fg, #1a1a1a);
    border-color: color-mix(in srgb, var(--tv-primary, #2563eb) 20%, var(--tv-border, #e2e8f0));
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 6%, transparent);
  }

  .confirm-btn {
    border: 1px solid transparent;
    background: var(--tv-primary, #2563eb);
    color: var(--tv-bg, #ffffff);
  }

  .confirm-btn:hover {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 90%, #000000);
  }

  .confirm-btn.danger {
    background: #dc2626;
    color: #ffffff;
  }

  .confirm-btn.danger:hover {
    background: #b91c1c;
  }

  .confirm-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--tv-primary, #2563eb) 50%, transparent);
    outline-offset: 2px;
  }
</style>

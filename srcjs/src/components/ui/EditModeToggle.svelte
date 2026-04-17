<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const active = $derived(store.editMode);
</script>

<button
  type="button"
  class="edit-btn"
  class:active
  onclick={() => store.toggleEditMode()}
  aria-pressed={active}
  aria-label={active ? "Exit edit mode" : "Enter edit mode"}
  data-tooltip={active ? "Exit edit mode" : "Edit mode — sort, filter, drag, edit"}
>
  <!-- Pencil icon -->
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
</button>

<style>
  .edit-btn {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; padding: 0;
    border: 1px solid var(--wf-border, #e2e8f0); border-radius: 6px;
    background: var(--wf-bg, #ffffff); color: var(--wf-secondary, #64748b);
    cursor: pointer; transition: background-color .15s, color .15s;
  }
  .edit-btn:hover { background: var(--wf-border, #e2e8f0); color: var(--wf-fg, #1a1a1a); }
  .edit-btn.active {
    background: var(--wf-primary, #2563eb); border-color: var(--wf-primary, #2563eb); color: #ffffff;
  }
</style>

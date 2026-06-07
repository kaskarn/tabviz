<!--
  PinsPanel — the studio's Tier-2/3 token-pin surface (settings-overhaul
  P3). The TOTAL-control channel the settings panel deliberately lacks:
  pin any manifest cssVar to a direct value, see every active pin with
  its provenance, release per-pin.

  Pins are typed-by-validation (TOKENS_BY_VAR) and overlay the resolve
  AFTER the cascade, BEFORE the contrast check — so the validate matrix
  and contrast banner judge pinned values, never a stale pre-pin state.
-->
<script lang="ts">
  import { studioStore } from "./studio-store.svelte";
  import { TOKENS_BY_VAR } from "$lib/theme/component-tokens";
  import Field from "$components/primitives/v2/Field.svelte";
  import TextInput from "$components/primitives/v2/TextInput.svelte";
  import DisclosureField from "$components/primitives/v2/DisclosureField.svelte";

  let open = $state(false);
  let draftVar = $state("");
  let draftValue = $state("");
  let error = $state<string | null>(null);

  const pinEntries = $derived(
    Object.entries(studioStore.pins).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const summary = $derived(
    pinEntries.length ? `${pinEntries.length} pinned` : "none",
  );

  function addPin(): void {
    error = null;
    const cssVar = draftVar.trim().startsWith("--tv-")
      ? draftVar.trim()
      : `--tv-${draftVar.trim()}`;
    if (!draftValue.trim()) {
      error = "Value required.";
      return;
    }
    try {
      studioStore.setPin(cssVar, draftValue.trim());
      draftVar = "";
      draftValue = "";
    } catch (e) {
      error = (e as Error).message;
    }
  }

  /** The resolved (post-pin) value, for the release-button tooltip.
   *  Named for what it IS (quality review: the old name `derivedValue`
   *  promised the PRE-pin cascade value, which resolved.cssVars cannot
   *  supply — full provenance lives in the inspector trace). */
  function resolvedPinValue(cssVar: string): string {
    return studioStore.resolved?.cssVars?.[cssVar] ?? "";
  }
</script>

<div class="pins-panel" data-tv-v2>
  <DisclosureField label="Token pins" {summary} bind:open>
    {#each pinEntries as [cssVar, value] (cssVar)}
      <Field label={cssVar.replace(/^--tv-/, "")} mono pinned onreset={() => studioStore.clearPin(cssVar)}>
        <span class="pin-row">
          <TextInput
            {value}
            alignLeft
            ariaLabel="{cssVar} pinned value"
            oncommit={(v) => v.trim() && studioStore.setPin(cssVar, v.trim())}
          />
          <button type="button" class="pin-clear"
                  title="Release pin ({resolvedPinValue(cssVar)})"
                  aria-label="Release pin {cssVar}"
                  onclick={() => studioStore.clearPin(cssVar)}>↻</button>
        </span>
      </Field>
    {/each}
    <div class="add-pin">
      <TextInput
        bind:value={draftVar}
        alignLeft
        placeholder="token (e.g. text-footnote-size)"
        ariaLabel="Token name to pin"
        ariaDescribedby={error ? "pin-error" : undefined}
        ariaInvalid={error != null}
      />
      <TextInput
        bind:value={draftValue}
        alignLeft
        placeholder="value"
        ariaLabel="Pinned value"
        ariaDescribedby={error ? "pin-error" : undefined}
        ariaInvalid={error != null}
        oncommit={addPin}
      />
      <button type="button" class="add-btn" onclick={addPin}>pin</button>
    </div>
    {#if error}
      <p class="pin-error" id="pin-error" role="alert">{error}</p>
    {/if}
    <p class="pin-hint">
      Pins write a manifest token directly — total control, validated
      against the {TOKENS_BY_VAR.size}-token manifest. They override the
      cascade and ride the exported theme.
    </p>
  </DisclosureField>
</div>

<style>
  .pins-panel {
    padding: 4px 12px 10px;
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
  }
  .pin-row {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    width: 100%;
    min-width: 0;
  }
  .pin-clear, .add-btn {
    flex: none;
    height: var(--v2-control-h, 22px);
    border: 0;
    background: transparent;
    color: var(--v2-ink-3, #8a8478);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
    padding: 0 6px;
    font-size: 11px;
  }
  .pin-clear:hover, .add-btn:hover {
    color: var(--v2-ink, #15140e);
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
  }
  .add-btn {
    border: 1px solid var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
  }
  .add-pin {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    padding: 4px 0 0 8px;
  }
  .pin-error {
    margin: 4px 0 0 8px;
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-hot, #b53a1f);
  }
  .pin-hint {
    margin: 6px 0 0 8px;
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
  }
</style>

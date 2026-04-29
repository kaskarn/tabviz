<script lang="ts">
  import type { AvailableField } from "$types";
  import type { FieldDescriptor } from "$lib/column-editor-schema";
  import FieldPicker from "./FieldPicker.svelte";

  interface Props {
    descriptor: FieldDescriptor;
    /** Current value at the descriptor's path (or undefined). */
    value: unknown;
    available: AvailableField[];
    onchange: (next: unknown) => void;
  }

  let { descriptor, value, available, onchange }: Props = $props();

  const d = $derived(descriptor);

  function num(v: unknown): number | "" {
    if (v === "" || v == null) return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
  }
</script>

{#if d.control === "number"}
  <label class="field" title={d.hint}>
    <span class="label">{d.label}</span>
    <input
      type="number"
      min={d.min}
      max={d.max}
      step={d.step}
      value={num(value)}
      placeholder={d.placeholder}
      oninput={(e) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        onchange(raw === "" ? undefined : Number(raw));
      }}
    />
    {#if d.unit}<span class="unit">{d.unit}</span>{/if}
  </label>
{:else if d.control === "text"}
  <label class="field" title={d.hint}>
    <span class="label">{d.label}</span>
    <input
      type="text"
      value={(value as string) ?? ""}
      placeholder={d.placeholder}
      oninput={(e) => {
        const v = (e.currentTarget as HTMLInputElement).value;
        onchange(v === "" ? undefined : v);
      }}
    />
  </label>
{:else if d.control === "checkbox"}
  <label class="check" title={d.hint}>
    <input
      type="checkbox"
      checked={!!value}
      onchange={(e) => onchange((e.currentTarget as HTMLInputElement).checked)}
    />
    <span>{d.label}</span>
  </label>
{:else if d.control === "color"}
  <label class="field color-field" title={d.hint}>
    <span class="label">{d.label}</span>
    <span class="color-controls">
      <input
        type="color"
        value={typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#3b82f6"}
        oninput={(e) => onchange((e.currentTarget as HTMLInputElement).value)}
        aria-label={d.label}
      />
      <input
        type="text"
        class="color-hex"
        placeholder={d.placeholder ?? "auto"}
        value={(value as string) ?? ""}
        oninput={(e) => {
          const v = (e.currentTarget as HTMLInputElement).value;
          onchange(v === "" ? undefined : v);
        }}
      />
    </span>
  </label>
{:else if d.control === "segmented"}
  <div class="field" title={d.hint}>
    <span class="label">{d.label}</span>
    <div class="segmented" role="radiogroup" aria-label={d.label}>
      {#each d.options ?? [] as opt (String(opt.value))}
        <button
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          class:selected={value === opt.value}
          onclick={() => onchange(opt.value)}
        >{opt.label}</button>
      {/each}
    </div>
  </div>
{:else if d.control === "select"}
  <label class="field" title={d.hint}>
    <span class="label">{d.label}</span>
    <select
      value={(value as string | number | boolean) ?? ""}
      onchange={(e) => {
        const raw = (e.currentTarget as HTMLSelectElement).value;
        const opt = (d.options ?? []).find((o) => String(o.value) === raw);
        onchange(opt?.value);
      }}
    >
      {#if d.placeholder}
        <option value="" disabled>{d.placeholder}</option>
      {/if}
      {#each d.options ?? [] as opt (String(opt.value))}
        <option value={String(opt.value)}>{opt.label}</option>
      {/each}
    </select>
  </label>
{:else if d.control === "field-picker"}
  <FieldPicker
    label={d.label}
    value={(value as string) ?? ""}
    {available}
    accepts={d.accepts}
    placeholder={d.placeholder}
    onchange={(v) => onchange(v === "" ? undefined : v)}
  />
{:else if d.control === "ticks-list"}
  <label class="field" title={d.hint}>
    <span class="label">{d.label}</span>
    <input
      type="text"
      value={Array.isArray(value) ? (value as number[]).join(", ") : ((value as string) ?? "")}
      placeholder={d.placeholder ?? "auto, or e.g. 0.5, 1, 2"}
      oninput={(e) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        if (raw.trim() === "") {
          onchange(undefined);
          return;
        }
        const parsed = raw
          .split(/[,\s]+/)
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n));
        onchange(parsed.length > 0 ? parsed : undefined);
      }}
    />
  </label>
{/if}

<style>
  .field {
    display: grid;
    grid-template-columns: 84px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 1px 0;
  }

  .label {
    font-size: 11px;
    color: var(--tv-text-muted, #64748b);
    font-weight: 500;
  }

  .unit {
    font-size: 11px;
    color: var(--tv-text-muted, #64748b);
  }

  .field input[type="text"],
  .field input[type="number"],
  .field select {
    width: 100%;
    padding: 3px 6px;
    font-size: 12px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-family: inherit;
    box-sizing: border-box;
  }

  .field input:focus,
  .field select:focus {
    outline: none;
    border-color: var(--tv-accent, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 2px 0;
  }

  .color-field .color-controls {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .color-field input[type="color"] {
    width: 24px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 3px;
    cursor: pointer;
    background: var(--tv-bg, #ffffff);
    flex-shrink: 0;
  }

  .color-hex {
    flex: 1;
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
  }

  .segmented {
    display: inline-flex;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    overflow: hidden;
  }

  .segmented button {
    padding: 3px 8px;
    border: none;
    background: transparent;
    color: var(--tv-text-muted, #64748b);
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
  }

  .segmented button + button {
    border-left: 1px solid var(--tv-border, #e2e8f0);
  }

  .segmented button.selected {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 18%, var(--tv-bg, #ffffff));
    color: var(--tv-accent, #2563eb);
  }
</style>

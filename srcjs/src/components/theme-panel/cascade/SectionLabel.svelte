<!--
  Pedagogical section header for the ThemePanel cascade. Renders a tier
  chip ([TIER 1 · COLOR], etc.) above a heading + 1-2-line prose hint so
  the panel reads top-to-bottom as the resolution flow.
-->
<script lang="ts">
  const {
    tier,
    kind,
    heading,
    prose,
  }: {
    tier: "1" | "2" | "3";
    kind: string;
    heading: string;
    prose: string;
  } = $props();
</script>

<header class="section-label" data-tier={tier}>
  <span class="chip">
    <span class="chip-tier">TIER {tier}</span>
    <span class="chip-dot">·</span>
    <span class="chip-kind">{kind}</span>
  </span>
  <h3>{heading}</h3>
  <p>{prose}</p>
</header>

<style>
  .section-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 18px 8px;
    border-top: 1px solid var(--tp-rule, #e8e6e1);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tp-chip-fg, #66635c);
    align-self: flex-start;
  }
  .chip-tier {
    padding: 2px 6px;
    border: 1px solid var(--tp-chip-rule, #c8c4bd);
    border-radius: 3px;
    background: var(--tp-chip-bg, #faf9f6);
  }
  .chip-dot { opacity: 0.5; }
  .chip-kind { letter-spacing: 0.12em; }
  h3 {
    margin: 4px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--tp-fg, #1c1a17);
  }
  p {
    margin: 0;
    color: var(--tp-muted, #6b6760);
    font-size: 12px;
    line-height: 1.45;
  }
  .section-label[data-tier="1"] .chip-tier { background: #fdf6ef; border-color: #e3d4be; color: #946a2c; }
  .section-label[data-tier="2"] .chip-tier { background: #f0eef8; border-color: #c8c3e0; color: #5e51a3; }
  .section-label[data-tier="3"] .chip-tier { background: #eef5f4; border-color: #b6cfcc; color: #3f6f6b; }
</style>

<script>
  import { parseResultView } from "@emseepea/server/ui";
  import { tick } from "svelte";

  let { view: candidate, headingLevel, onAction, idPrefix } = $props();
  const componentId = $props.id();
  const view = $derived(parseResultView(candidate));
  const level = $derived(checkedHeadingLevel(headingLevel));
  const prefix = $derived(idPrefix === undefined
    ? `${view.id}-${componentId.replaceAll(":", "")}`
    : checkedIdentifier("idPrefix", idPrefix));
  const headingId = $derived(`${prefix}--heading`);
  let result = $state();
  let lastFocusKey = "";

  $effect(() => {
    if (view.state.focusTarget === "none") {
      lastFocusKey = "";
      return;
    }
    const focusKey = `${view.state.kind}\u0000${view.state.focusTarget}\u0000${view.state.status}`;
    if (lastFocusKey === focusKey) return;
    lastFocusKey = focusKey;
    tick().then(() => {
      if (lastFocusKey !== focusKey) return;
      const target = view.state.focusTarget === "result"
        ? result
        : view.state.focusTarget === "status"
          ? result?.querySelector('[data-emseepea-part="status"]')
          : result?.querySelector('[data-emseepea-part="action"]:not(:disabled)');
      target?.focus();
    });
  });

  function checkedHeadingLevel(value) {
    if (![2, 3, 4, 5, 6].includes(value)) throw new TypeError("headingLevel must be an integer from 2 to 6");
    return value;
  }

  function checkedIdentifier(field, value) {
    if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) {
      throw new TypeError(`${field} must be a valid identifier`);
    }
    return value;
  }
</script>

<section
  bind:this={result}
  data-emseepea-part="result-view"
  data-emseepea-state={view.state.kind}
  aria-labelledby={headingId}
  tabindex={view.state.focusTarget === "result" ? -1 : undefined}
  autofocus={view.state.focusTarget === "result"}
>
  <svelte:element this={`h${level}`} id={headingId}>{view.heading}</svelte:element>
  <div
    data-emseepea-part="status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-relevant="additions text"
    tabindex={view.state.focusTarget === "status" ? -1 : undefined}
    autofocus={view.state.focusTarget === "status"}
  >{view.state.status}</div>
  {#if view.headline}<p data-emseepea-part="headline">{view.headline}</p>{/if}
  {#if view.summary}<p data-emseepea-part="summary">{view.summary}</p>{/if}
  {#if view.metrics.length}
    <dl data-emseepea-part="metrics">
      {#each view.metrics as metric (`${metric.label}:${metric.value}`)}
        <div data-emseepea-part="metric">
          <dt>{metric.label}{#if metric.hint} <span data-emseepea-part="hint">({metric.hint})</span>{/if}</dt>
          <dd>{metric.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}
  {#if view.reasons}
    <div data-emseepea-part="reasons">
      <p id={`${prefix}--reasons-label`} data-emseepea-part="reasons-label">{view.reasons.label}</p>
      <ul aria-labelledby={`${prefix}--reasons-label`}>
        {#each view.reasons.items as item (item)}<li>{item}</li>{/each}
      </ul>
    </div>
  {/if}
  {#if view.assumptions}
    <div data-emseepea-part="assumptions">
      <p id={`${prefix}--assumptions-label`} data-emseepea-part="assumptions-label">{view.assumptions.label}</p>
      <ul aria-labelledby={`${prefix}--assumptions-label`}>
        {#each view.assumptions.items as item (item)}<li>{item}</li>{/each}
      </ul>
    </div>
  {/if}
  {#if view.disclosure}
    <details data-emseepea-part="disclosure">
      <summary>{view.disclosure.label}</summary>
      <ul>{#each view.disclosure.items as item (item)}<li>{item}</li>{/each}</ul>
    </details>
  {/if}
  {#if view.actions.length}
    <div data-emseepea-part="actions" role="group" aria-label={view.actionsLabel}>
      {#each view.actions as action (action.id)}
        <button
          type="button"
          data-emseepea-part="action"
          data-emseepea-action={action.id}
          aria-label={action.accessibleName}
          disabled={action.disabled}
          autofocus={view.state.focusTarget === "actions" && !action.disabled && view.actions.findIndex((item) => !item.disabled) === view.actions.indexOf(action)}
          onclick={() => onAction?.(action)}
        >{action.label}</button>
      {/each}
    </div>
  {/if}
  <p data-emseepea-part="disclaimer">{view.disclaimer}</p>
</section>

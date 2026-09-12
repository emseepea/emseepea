<script>
  import ResultCard from "../src/ResultCard.svelte";

  let view = $state({
    id: "browser-result",
    heading: "Your estimate",
    headline: "$640,000",
    metrics: [{ label: "Monthly income", value: "$9,100" }],
    disclaimer: "This is an estimate, not a lending decision.",
    actionsLabel: "Explore another estimate",
    actions: [
      { id: "disabled", label: "Unavailable", disabled: true },
      { id: "without-card", label: "Without the credit card", accessibleName: "Recalculate without the credit card" },
    ],
    state: { kind: "ready", status: "Borrowing estimate ready: $640,000.", focusTarget: "none" },
  });
  const passive = $derived({ ...view, state: { ...view.state, focusTarget: "none" } });
  window.emseepeaUpdate = (next) => view = { ...view, ...next };
</script>

<ResultCard {view} headingLevel={2} onAction={() => {}} />
<ResultCard view={passive} headingLevel={3} onAction={() => {}} />

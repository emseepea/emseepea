import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("Pea variety details keep each concept distinct", {
  server: new URL("../dist/server.js", import.meta.url),
  question:
    "For Highland Snap, give me its pea type, growth habit, days to maturity, and " +
    "traits. Keep those concepts distinct.",
  criticalFacts: [
    "snap",
    "climbing",
    "70",
    "edible pods",
    "needs support"
  ],
  criteria:
    "The answer says Highland Snap is a snap pea with a climbing growth habit, " +
    "matures in 70 days, has edible pods, and needs support. It does not confuse " +
    "pea type, growth habit, maturity time, or traits.",
  expectedTools: ["get-pea-variety"],
});

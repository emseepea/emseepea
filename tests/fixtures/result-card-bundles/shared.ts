import { defineResultView } from "@emseepea/server/ui";

export const loading = defineResultView({
  id: "comparison",
  heading: "Result preview",
  disclaimer: "This is a preview.",
  state: { kind: "loading", status: "Waiting for the result.", focusTarget: "none" },
});

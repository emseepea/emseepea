import { testUiExample } from "@emseepea/example-ui-shared/testing";

testUiExample({
  name: "react",
  h1: "React and Tailwind form example",
  react: true,
  serverUrl: new URL("../dist/server.js", import.meta.url),
});

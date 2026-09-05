import { testUiExample } from "@emseepea/example-ui-shared/testing";

testUiExample({
  name: "native",
  h1: "Native form example",
  serverUrl: new URL("../dist/server.js", import.meta.url),
});

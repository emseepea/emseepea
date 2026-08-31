import { testUiExample } from "@emseepea/example-ui-shared/testing";

testUiExample({
  name: "native",
  serverUrl: new URL("../dist/server.js", import.meta.url),
});

import { testUiExample } from "@emseepea/example-ui-shared/testing";

testUiExample({
  name: "react",
  react: true,
  serverUrl: new URL("../dist/server.js", import.meta.url),
});

import { testUiExample } from "../../ui-shared/test/browser-contract.mjs";

testUiExample({
  name: "native",
  serverUrl: new URL("../dist/server.js", import.meta.url),
});

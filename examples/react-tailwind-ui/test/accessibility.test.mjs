import { testUiExample } from "../../ui-shared/test/browser-contract.mjs";

testUiExample({
  name: "react",
  react: true,
  serverUrl: new URL("../dist/server.js", import.meta.url),
});

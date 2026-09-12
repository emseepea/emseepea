import { ResultCard, useMcpApp } from "@emseepea/react";
import { parseResultView } from "@emseepea/server/ui";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { loading } from "./shared.js";

function App() {
  const app = useMcpApp({ name: "Result", version: "1.0.0", parseResult: parseResultView });
  return <ResultCard view={app.result ?? loading} headingLevel={2} onAction={() => void app.sendMessage("Continue")} />;
}

createRoot(document.getElementById("app")!).render(createElement(App));

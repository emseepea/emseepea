import { ElicitationForm } from "@emseepea/react";
import { parseElicitationView, type ElicitationView } from "@emseepea/server/ui";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";

const root = document.querySelector<HTMLElement>("#app");
const source = document.querySelector<HTMLScriptElement>("#emseepea-view");
if (!root || !source?.textContent) throw new Error("The server-rendered view is missing");
const initial = parseElicitationView(JSON.parse(source.textContent));

function App({ initialView }: { readonly initialView: ElicitationView }) {
  const [view, setView] = useState(initialView);
  const submit = (data: FormData) => {
    void fetch("/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams([...data.entries()].map(([name, value]) => [name, String(value)])),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Preview returned ${response.status}`);
      setView(parseElicitationView(await response.json()));
    }).catch(() => {
      setView(parseElicitationView({
        ...view,
        state: {
          kind: "ready",
          focusTarget: "none",
          status: "The preview could not be updated. Check your connection and try again.",
        },
      }));
    });
  };
  return <ElicitationForm view={view} headingLevel={2} onSubmit={submit} />;
}

hydrateRoot(root, <App initialView={initial} />);

import { ResultCard, useMcpApp } from "@emseepea/react";
import { defineResultView, type ResultView as ResultViewModel } from "@emseepea/server/ui";
import { useEffect, useState } from "react";
import { hydrateRoot } from "react-dom/client";

interface PlantingPlanResult {
  readonly title: string;
  readonly matchingCount: number;
  readonly varieties: readonly {
    readonly name: string;
    readonly growthHabit: "bush" | "climbing";
    readonly peaType: "shelling" | "snap";
  }[];
  readonly notice: string;
}

export function ResultApp() {
  const app = useMcpApp({ name: "Pea planting plan result", version: "1.0.0", parseResult: parsePlantingPlan });
  const [action, setAction] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (app.hostContext.theme) document.documentElement.dataset.emseepeaTheme = app.hostContext.theme;
  }, [app.hostContext.theme]);

  const view = resultView(app, action);
  const act = async () => {
    if (action !== "idle") return;
    setAction("sending");
    try {
      await app.sendMessage("Show me growing tips for these pea varieties.");
      setAction("sent");
    } catch {
      setAction("error");
    }
  };

  return (
    <>
      <h1>Pea planting plan result</h1>
      <ResultCard view={view} headingLevel={2} idPrefix="pea-result" onAction={() => void act()} />
    </>
  );
}

function resultView(
  app: ReturnType<typeof useMcpApp<PlantingPlanResult>>,
  action: "idle" | "sending" | "sent" | "error",
): ResultViewModel {
  const base = {
    id: "pea-planting-plan-result",
    heading: app.result?.title ?? "Planting plan preview",
    disclaimer: app.result?.notice ?? "No report will be sent or stored.",
  };
  if (app.status === "connecting" || app.status === "ready") {
    return defineResultView({
      ...base,
      state: { kind: "loading", status: "Waiting for the preview result.", focusTarget: "none" },
    });
  }
  if (app.status === "cancelled") {
    return defineResultView({
      ...base,
      summary: "The preview was cancelled.",
      state: { kind: "empty", status: "The preview was cancelled.", focusTarget: "none" },
    });
  }
  if (app.status === "error" || !app.result) {
    const error = app.error ?? "The preview result could not be displayed.";
    return defineResultView({ ...base, summary: error, state: { kind: "error", status: error, focusTarget: "status" } });
  }
  const count = app.result.matchingCount;
  const headline = `${count} sample pea ${count === 1 ? "variety matches" : "varieties match"}.`;
  const actions = [{
    id: "growing-tips",
    label: "Ask for growing tips",
    accessibleName: "Ask for growing tips for these varieties",
    disabled: action !== "idle",
  }];
  const actionState = action === "sending"
    ? { kind: "sending" as const, status: "Asking for growing tips.", focusTarget: "status" as const }
    : action === "sent"
      ? { kind: "sent" as const, status: "Asked for growing tips in the chat.", focusTarget: "status" as const }
      : action === "error"
        ? { kind: "error" as const, status: "Growing tips could not be requested. Ask in the chat instead.", focusTarget: "status" as const }
        : {
            kind: app.resultRevision > 1 ? "updated" as const : count === 0 ? "empty" as const : "ready" as const,
            status: app.resultRevision > 1 ? `Preview updated: ${headline}` : headline,
            focusTarget: "none" as const,
          };
  return defineResultView({
    ...base,
    headline: count > 0 ? headline : undefined,
    summary: count === 0 ? "No sample pea varieties match this preview." : undefined,
    metrics: [{ label: "Matching varieties", value: String(count) }],
    disclosure: app.result.varieties.length ? {
      label: "Included varieties",
      items: app.result.varieties.map(({ name, growthHabit, peaType }) => `${name}, ${growthHabit} ${peaType} pea`),
    } : undefined,
    actionsLabel: "Continue in chat",
    actions,
    state: actionState,
  });
}

function parsePlantingPlan(value: unknown): PlantingPlanResult {
  if (!record(value) || typeof value.title !== "string" || value.title.length > 80 ||
      !Number.isSafeInteger(value.matchingCount) || (value.matchingCount as number) < 0 ||
      !Array.isArray(value.varieties) || value.varieties.length > 32 || typeof value.notice !== "string") {
    throw new TypeError("Invalid planting-plan result");
  }
  const varieties = value.varieties.map((candidate) => {
    if (!record(candidate) || typeof candidate.name !== "string" || candidate.name.length > 160 ||
        (candidate.growthHabit !== "bush" && candidate.growthHabit !== "climbing") ||
        (candidate.peaType !== "shelling" && candidate.peaType !== "snap")) {
      throw new TypeError("Invalid planting-plan variety");
    }
    return {
      name: candidate.name,
      growthHabit: candidate.growthHabit as "bush" | "climbing",
      peaType: candidate.peaType as "shelling" | "snap",
    };
  });
  if (value.matchingCount !== varieties.length || value.notice.length > 1_000) {
    throw new TypeError("Inconsistent planting-plan result");
  }
  return { title: value.title, matchingCount: value.matchingCount as number, varieties, notice: value.notice };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const root = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("#app");
if (root) hydrateRoot(root, <ResultApp />);

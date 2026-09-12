import { createMcpAppController } from "@emseepea/server/ui";
import { readable } from "svelte/store";

export function createMcpApp(options) {
  const controller = createMcpAppController(options);
  const state = readable(controller.getState(), (set) => {
    const unsubscribe = controller.subscribe(() => set(controller.getState()));
    const disconnect = typeof window === "undefined" ? undefined : controller.connect(window);
    return () => {
      unsubscribe();
      disconnect?.();
    };
  });
  return { subscribe: state.subscribe, sendMessage: controller.sendMessage };
}

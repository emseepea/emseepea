import { createPreviewPlantingPlanTool } from "@emseepea/example-ui-shared";
import type { CapabilityModuleFactory } from "@emseepea/server";

export default (() => createPreviewPlantingPlanTool()) satisfies CapabilityModuleFactory;

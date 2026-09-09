import { createPreviewPlantingPlanTool } from "@emseepea/example-ui-shared";
import type { AccessPolicy, CapabilityModuleFactory } from "@emseepea/server";

export default ((access) => createPreviewPlantingPlanTool(access)) satisfies CapabilityModuleFactory<AccessPolicy>;

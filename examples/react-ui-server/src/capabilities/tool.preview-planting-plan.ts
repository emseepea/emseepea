import { createPreviewPlantingPlanTool } from "@emseepea/example-ui-shared";
import type { AccessPolicy, CapabilityModuleFactory } from "@emseepea/server";
import { plantingPlanAppResource } from "../pea-planting-plan-app-resource.js";

export default ((access) => createPreviewPlantingPlanTool(access, plantingPlanAppResource(access).toolMetadata)) satisfies CapabilityModuleFactory<AccessPolicy>;

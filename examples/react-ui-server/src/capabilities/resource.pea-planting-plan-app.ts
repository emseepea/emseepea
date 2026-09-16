import type { AccessPolicy, CapabilityModuleFactory } from "@emseepea/server";
import { plantingPlanAppResource } from "../pea-planting-plan-app-resource.js";

export default ((access) => plantingPlanAppResource(access).resource) satisfies CapabilityModuleFactory<AccessPolicy>;

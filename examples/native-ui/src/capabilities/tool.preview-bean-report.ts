import { createPreviewBeanReportTool } from "@emseepea/example-ui-shared";
import type { CapabilityModuleFactory } from "@emseepea/server";

export default (() => createPreviewBeanReportTool()) satisfies CapabilityModuleFactory;

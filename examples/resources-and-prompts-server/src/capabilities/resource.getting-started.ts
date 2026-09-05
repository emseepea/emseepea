import { defineResource, type CapabilityModuleFactory } from "@emseepea/server";

const guideUri = "guide://peas/getting-started";

export default (() => defineResource({
  name: "getting-started",
  uri: guideUri,
  title: "Pea growing: getting started",
  description: "A sample guide exposed as an MCP resource.",
  mimeType: "text/markdown",
  handler: () => ({
    contents: [{
      uri: guideUri,
      mimeType: "text/markdown",
      text: "# Plant peas clearly\n\nSowing depth is how deep a seed goes; plant spacing is the gap between plants. They are separate choices, not interchangeable measurements.\n",
    }],
  }),
})) satisfies CapabilityModuleFactory;

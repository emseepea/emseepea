import { defineResource, type CapabilityModuleFactory } from "@emseepea/server";

const guideUri = "guide://coffee/getting-started";

export default (() => defineResource({
  name: "getting-started",
  uri: guideUri,
  title: "Coffee getting started",
  description: "A sample guide exposed as an MCP resource.",
  mimeType: "text/markdown",
  handler: () => ({
    contents: [{
      uri: guideUri,
      mimeType: "text/markdown",
      text: "# Brew clearly\n\nStrength is concentration; extraction is how much material left the grounds. They are related, but not interchangeable.\n",
    }],
  }),
})) satisfies CapabilityModuleFactory;

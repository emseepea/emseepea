import { defineResourceTemplate, type CapabilityModuleFactory } from "@emseepea/server";

const methods = ["aeropress", "espresso", "pour-over"];

export default (() => defineResourceTemplate({
  name: "method-guide",
  uriTemplate: "guide://coffee/method/{method}",
  title: "Coffee method guide",
  description: "A sample guide selected by brewing method.",
  mimeType: "text/markdown",
  complete: {
    method: (value) => methods.filter((method) => method.startsWith(value)),
  },
  handler: ({ uri, variables }) => ({
    contents: [{
      uri,
      mimeType: "text/markdown",
      text: `# ${String(variables.method)}\n`,
    }],
  }),
})) satisfies CapabilityModuleFactory;

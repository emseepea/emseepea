import { defineResourceTemplate, type AccessPolicy, type CapabilityModuleFactory } from "@emseepea/server";

const methods = ["container", "raised-bed", "row"];

export default ((access) => defineResourceTemplate({
  ...access,
  name: "planting-guide",
  uriTemplate: "guide://peas/planting/{method}",
  title: "Pea planting guide",
  description: "A sample guide selected by planting method.",
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
})) satisfies CapabilityModuleFactory<AccessPolicy>;

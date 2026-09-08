const { makePgTsGenerator } = require("kanel");
const { generateZodSchemas } = require("kanel-zod");

module.exports = {
  connection: process.env.DATABASE_URL ?? "postgres://emseepea:emseepea@127.0.0.1:5432/emseepea",
  schemaNames: ["public"],
  resolveViews: true,
  outputPath: "./src/generated",
  preDeleteOutputFolder: true,
  typescriptConfig: {
    enumStyle: "literal-union",
    tsModuleFormat: "explicit-esm",
  },
  generators: [makePgTsGenerator({
    filter: ({ kind }) => kind !== "procedure",
    preRenderHooks: [generateZodSchemas],
  })],
};

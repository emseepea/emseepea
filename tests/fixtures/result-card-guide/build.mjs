import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { compile } from "svelte/compiler";

const sveltePlugin = {
  name: "svelte",
  setup(builder) {
    builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
      contents: compile(await readFile(path, "utf8"), {
        filename: path,
        generate: "client",
        dev: false,
      }).js.code,
      loader: "js",
    }));
  },
};

for (const entry of ["native.ts", "react.tsx", "svelte.ts"]) {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    plugins: entry === "svelte.ts" ? [sveltePlugin] : [],
  });
}

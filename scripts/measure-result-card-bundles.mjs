import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { compile } from "svelte/compiler";

const entries = {
  react: new URL("../tests/fixtures/result-card-bundles/react.tsx", import.meta.url).pathname,
  svelte: new URL("../tests/fixtures/result-card-bundles/svelte.js", import.meta.url).pathname,
};
const sveltePlugin = {
  name: "svelte",
  setup(builder) {
    builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
      contents: compile(await readFile(path, "utf8"), { filename: path, generate: "client", dev: false }).js.code,
      loader: "js",
    }));
  },
};
const measurements = {};

for (const [name, entry] of Object.entries(entries)) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    sourcemap: false,
    write: false,
    plugins: name === "svelte" ? [sveltePlugin] : [],
  });
  const bytes = result.outputFiles[0].contents;
  measurements[name] = {
    raw: bytes.byteLength,
    gzip: gzipSync(bytes, { level: 9 }).byteLength,
    brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).byteLength,
  };
}

const reduction = Object.fromEntries(["raw", "gzip", "brotli"].map((format) => [
  format,
  Number((100 * (1 - measurements.svelte[format] / measurements.react[format])).toFixed(1)),
]));
process.stdout.write(`${JSON.stringify({
  tools: { esbuild: "0.28.2", svelte: "5.57.0", react: "19.2.8", reactDom: "19.2.8" },
  settings: { minify: true, format: "esm", target: "es2022", sourceMap: false, gzipLevel: 9, brotliQuality: 11 },
  measurements,
  reduction,
})}\n`);

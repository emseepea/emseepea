import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const publicPackages = [
  { name: "@emseepea/server", path: "packages/framework", key: "server" },
  { name: "@emseepea/testing", path: "packages/testing", key: "testing" },
  { name: "@emseepea/react", path: "packages/react", key: "react" },
  { name: "@emseepea/tailwind", path: "packages/tailwind", key: "tailwind" },
  {
    name: "@emseepea/create-tool-server",
    path: "packages/create-tool-server",
    key: "create-tool-server",
    example: "basic-no-ui",
    description: "Create an Em See Pea server with one public tool.",
  },
  {
    name: "@emseepea/create-api-backed-server",
    path: "packages/create-api-backed-server",
    key: "create-api-backed-server",
    example: "backend-no-ui",
    description: "Create an Em See Pea server backed by a public web API.",
  },
  {
    name: "@emseepea/create-sign-in-tool-server",
    path: "packages/create-sign-in-tool-server",
    key: "create-sign-in-tool-server",
    example: "protected-no-ui",
    description: "Create an Em See Pea server with a sign-in protected tool.",
  },
  {
    name: "@emseepea/create-resources-and-prompts-server",
    path: "packages/create-resources-and-prompts-server",
    key: "create-resources-and-prompts-server",
    example: "resources-prompts",
    description: "Create an Em See Pea server with resources and prompts.",
  },
  {
    name: "@emseepea/create-progress-streaming-server",
    path: "packages/create-progress-streaming-server",
    key: "create-progress-streaming-server",
    example: "streaming-progress",
    description: "Create an Em See Pea server that streams tool progress.",
  },
  {
    name: "@emseepea/create-html-ui-server",
    path: "packages/create-html-ui-server",
    key: "create-html-ui-server",
    example: "native-ui",
    description: "Create an Em See Pea server with an accessible HTML form.",
  },
  {
    name: "@emseepea/create-react-ui-server",
    path: "packages/create-react-ui-server",
    key: "create-react-ui-server",
    example: "react-tailwind-ui",
    description: "Create an Em See Pea server with an accessible React form.",
  },
  {
    name: "@emseepea/create-multi-instance-sqlite-server",
    path: "packages/create-multi-instance-sqlite-server",
    key: "create-multi-instance-sqlite-server",
    example: "multi-instance",
    description: "Create a two-instance Em See Pea server backed by SQLite.",
  },
];

export const initializerPackages = publicPackages.filter(({ example }) => example);

export async function publishablePackages(directory = process.cwd()) {
  const packages = await Promise.all(publicPackages.map(async (item) => ({
    ...item,
    manifest: JSON.parse(await readFile(join(directory, item.path, "package.json"), "utf8")),
  })));
  return packages.filter(({ manifest }) => manifest.private !== true);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const packages = process.argv.includes("--publishable")
    ? await publishablePackages()
    : process.argv.includes("--initializers")
      ? initializerPackages
      : publicPackages;
  if (process.argv.includes("--tsv")) {
    for (const item of packages) {
      const manifest = item.manifest ?? JSON.parse(await readFile(join(item.path, "package.json"), "utf8"));
      const init = item.example ? `@emseepea/${item.name.split("/create-")[1]}` : "";
      process.stdout.write([item.name, item.path, item.key, manifest.version, init, item.example ?? ""].join("\t") + "\n");
    }
  } else {
    process.stdout.write(`${JSON.stringify(packages)}\n`);
  }
}

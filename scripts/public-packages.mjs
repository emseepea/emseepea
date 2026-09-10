import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const publicPackages = [
  { name: "@emseepea/server", path: "packages/framework", key: "server" },
  { name: "@emseepea/feedback", path: "packages/feedback", key: "feedback" },
  { name: "@emseepea/testing", path: "packages/testing", key: "testing" },
  { name: "@emseepea/react", path: "packages/react", key: "react" },
  { name: "@emseepea/tailwind", path: "packages/tailwind", key: "tailwind" },
  {
    name: "@emseepea/create-tool-server",
    path: "examples/tool-server",
    key: "create-tool-server",
    example: "tool-server",
    description: "Create an Em See Pea server with one tool.",
    replaces: {
      name: "@emseepea/create-sign-in-tool-server",
      deprecation: "Deprecated: use @emseepea/create-tool-server and add authentication instead.",
    },
  },
  {
    name: "@emseepea/create-api-backed-server",
    path: "examples/api-backed-server",
    key: "create-api-backed-server",
    example: "api-backed-server",
    description: "Create an Em See Pea server backed by a web API.",
  },
  {
    name: "@emseepea/create-resources-and-prompts-server",
    path: "examples/resources-and-prompts-server",
    key: "create-resources-and-prompts-server",
    example: "resources-and-prompts-server",
    description: "Create an Em See Pea server with resources and prompts.",
  },
  {
    name: "@emseepea/create-progress-streaming-server",
    path: "examples/progress-streaming-server",
    key: "create-progress-streaming-server",
    example: "progress-streaming-server",
    description: "Create an Em See Pea server that streams tool progress.",
  },
  {
    name: "@emseepea/create-html-ui-server",
    path: "examples/html-ui-server",
    key: "create-html-ui-server",
    example: "html-ui-server",
    description: "Create an Em See Pea server with an accessible HTML form.",
  },
  {
    name: "@emseepea/create-react-ui-server",
    path: "examples/react-ui-server",
    key: "create-react-ui-server",
    example: "react-ui-server",
    description: "Create an Em See Pea server with an accessible React form.",
  },
  {
    name: "@emseepea/create-multi-instance-postgres-server",
    path: "examples/multi-instance-postgres-server",
    key: "create-multi-instance-postgres-server",
    example: "multi-instance-postgres-server",
    description: "Create interchangeable Em See Pea server instances sharing PostgreSQL state.",
    replaces: {
      name: "@emseepea/create-multi-instance-sqlite-server",
      deprecation: "Deprecated: use @emseepea/create-multi-instance-postgres-server instead.",
    },
  },
  {
    name: "@emseepea/create-database-schema-server",
    path: "examples/database-schema-server",
    key: "create-database-schema-server",
    example: "database-schema-server",
    description: "Create an Em See Pea server with internal validation generated from a PostgreSQL schema.",
  },
  {
    name: "@emseepea/create-mongodb-backed-server",
    path: "examples/mongodb-backed-server",
    key: "create-mongodb-backed-server",
    example: "mongodb-backed-server",
    description: "Create an Em See Pea server with schema-enforced and schemaless MongoDB collections.",
  },
  {
    name: "@emseepea/create-soap-backed-server",
    path: "examples/soap-backed-server",
    key: "create-soap-backed-server",
    example: "soap-backed-server",
    description: "Create an Em See Pea server that validates a SOAP service from its XSD contract.",
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

export async function hasUntaggedPublishablePackage(
  directory = process.cwd(),
  tagExists = async (tag) => {
    try {
      await exec("git", ["show-ref", "--tags", "--verify", "--quiet", `refs/tags/${tag}`], { cwd: directory });
      return true;
    } catch (error) {
      if (error.code === 1) return false;
      throw error;
    }
  },
) {
  for (const { name, manifest } of await publishablePackages(directory)) {
    if (!await tagExists(`${name}@${manifest.version}`)) return true;
  }
  return false;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (process.argv.includes("--has-untagged")) {
    process.stdout.write(`${await hasUntaggedPublishablePackage()}\n`);
  } else {
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
}

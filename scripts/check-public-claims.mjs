import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url)));
const supportLink = /\]\((?:https:\/\/github\.com\/emseepea\/emseepea\/blob\/main\/)?SUPPORT\.md#maturity-and-support\)|\]\(https:\/\/emseepea\.github\.io\/emseepea\/#maturity-and-support\)/;
const exceptions = new Set(["SUPPORT.md", "website/src/content/docs/index.md"]);
const errors = [];

async function content(file) {
  return readFile(path.join(root, file), "utf8");
}

async function publishedReadmes() {
  const files = [];
  for (const directory of ["packages", "examples"]) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = `${directory}/${entry.name}`;
      let manifest;
      try {
        manifest = JSON.parse(await content(`${folder}/package.json`));
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      if (manifest.private !== true && manifest.name?.startsWith("@emseepea/")) files.push(`${folder}/README.md`);
    }
  }
  return files;
}

const website = (await readdir(path.join(root, "website/src/content/docs"))).filter((name) => /\.mdx?$/.test(name))
  .map((name) => `website/src/content/docs/${name}`);
const readmes = await publishedReadmes();
const files = ["README.md", "SECURITY.md", "SUPPORT.md", "CONTRIBUTING.md", "RISK-POLICY.md", ...readmes, ...website];
for (const file of files) {
  const text = await content(file);
  if (/pre-alpha|supports part of MCP|not the entire protocol|Node\.js 22 or 24/i.test(text)) {
    errors.push(`${file}: stale public claim`);
  }
  if (!exceptions.has(file)) {
    for (const paragraph of text.split(/\n\s*\n/)) {
      if (/\bbeta\b/i.test(paragraph) && !supportLink.test(paragraph)) {
        errors.push(`${file}: beta needs a direct link to its four limits`);
      }
    }
  }
}
for (const file of readmes) {
  if (!/\bbeta\b/i.test(await content(file))) errors.push(`${file}: published package needs a maturity statement`);
}

const support = (await content("SUPPORT.md")).replace(/\s+/g, " ");
if (!/\bbeta\b/i.test(support)) errors.push("SUPPORT.md: missing beta label");
for (const claim of [/verified end to end/i, /below 1\.0.*breaking changes/i, /newest.*npm.*latest.*security fixes/i, /no production-support promise.*no backport promise.*no response-time promise/i]) {
  if (!claim.test(support)) errors.push(`SUPPORT.md: missing approved beta limit ${claim}`);
}

const homepage = (await content("website/src/content/docs/index.md")).replace(/\s+/g, " ");
for (const claim of [/verified end to end/i, /below 1\.0.*breaking changes/i, /newest.*npm.*latest.*security fixes/i, /no production-support promise.*no backport promise.*no response-time promise/i]) {
  if (!claim.test(homepage)) errors.push(`website index: missing approved beta limit ${claim}`);
}
for (const claim of [
  /\bbeta\b/i,
  /2026-07-28.*Streamable HTTP/i,
  /2025-11-25/, /2025-06-18/, /2025-03-26/, /2024-11-05/, /2024-10-07/,
  /initialization.*tool listing.*tool invocation/i,
  /list-change notifications/i, /extension-notification registration point/i, /Sampling/i,
  /protocol-coverage\.md/,
  /Node\.js 22 or newer/i, /22\.13\.0/, /CI.*Node\.js 22 and 24/i,
]) {
  if (!claim.test(homepage)) errors.push(`website index: missing approved claim ${claim}`);
}
for (const starter of ["database-schema-server", "mongodb-backed-server", "multi-instance-postgres-server", "soap-backed-server"]) {
  if (!/Node\.js 22\.13\.0 or newer/.test(await content(`examples/${starter}/README.md`))) {
    errors.push(`${starter}: missing Node.js floor`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
}

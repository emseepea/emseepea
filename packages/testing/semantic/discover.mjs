import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function discoverTests(paths) {
  const files = new Set();
  async function visit(path) {
    const info = await stat(path);
    if (info.isFile()) {
      if (!path.endsWith(".test.mjs")) throw new Error("Expected a .test.mjs file");
      files.add(resolve(path));
    } else if (info.isDirectory()) {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.isDirectory() || (entry.isFile() && entry.name.endsWith(".test.mjs"))) await visit(join(path, entry.name));
      }
    }
  }
  for (const path of paths) await visit(resolve(path));
  if (!files.size) throw new Error("No semantic test files found");
  return [...files].sort();
}

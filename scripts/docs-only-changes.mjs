import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
async function git(args) {
  const { stdout } = await exec("git", args, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}

export async function docsOnly(base, sha) {
  try {
    if (![base, sha].every((oid) => /^[a-f0-9]{40}$/.test(oid ?? "") && oid !== "0".repeat(40))) return false;
    await git(["merge-base", "--is-ancestor", base, sha]);
    const paths = (await git(["diff", "--no-renames", "--name-only", "-z", base, sha, "--"]))
      .split("\0").filter(Boolean);
    if (paths.length === 0 || paths.some((path) => !/^docs\/(briefing|problems|retros|reviews)\/.+\.md$/.test(path))) return false;
    for (const revision of [base, sha]) {
      const entries = (await git(["ls-tree", "-z", revision, "--", ...paths])).split("\0").filter(Boolean);
      if (entries.some((entry) => !entry.startsWith("100644 blob "))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(await docsOnly(...process.argv.slice(2, 4)));
}

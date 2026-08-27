import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");

test("semantic qualification runs only for the exact publication commit", () => {
  assert.match(
    workflow,
    /- name: Qualify every example through Model Context Protocol \(MCP\)\n\s+if: steps\.release-state\.outputs\.has_changesets == 'false'/,
  );
  assert.match(
    workflow,
    /- name: Upload redacted semantic evidence\n\s+if: \$\{\{ always\(\) && steps\.release-state\.outputs\.has_changesets == 'false' \}\}/,
  );
});

test("release preparation and publication do not run when release state is unknown", () => {
  assert.match(
    workflow,
    /needs\.semantic-eval\.outputs\.has_changesets == 'true' \|\| \(needs\.semantic-eval\.outputs\.has_changesets == 'false' && needs\.semantic-eval\.result == 'success'\)/,
  );
  assert.doesNotMatch(
    workflow,
    /needs\.semantic-eval\.outputs\.has_changesets == 'true' \|\| needs\.semantic-eval\.result == 'success'/,
  );
});

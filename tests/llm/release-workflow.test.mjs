import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));

test("the Claude subscription check runs only for the publication revision", () => {
  assert.match(
    workflow,
    /- name: Check whether a language model understands every example\n\s+if: steps\.release-state\.outputs\.has_changesets == 'false'\n\s+env:\n\s+CLAUDE_CODE_OAUTH_TOKEN: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}\n\s+run: npm run test:eval:ci/,
  );
  assert.match(
    workflow,
    /- name: Upload redacted language-model evidence\n\s+if: \$\{\{ always\(\) && steps\.release-state\.outputs\.has_changesets == 'false' \}\}[\s\S]*retention-days: 14/,
  );
  assert.doesNotMatch(
    workflow,
    /copilot-requests|EMSEEPEA_COPILOT|@github\/copilot/,
  );
  const job = workflow.match(/  semantic-eval:[\s\S]*?\n  changesets:/)?.[0] ?? "";
  assert.match(job, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(job, /contents: write|id-token: write|pull-requests: write|checks: write/);
  assert.equal((job.match(/CLAUDE_CODE_OAUTH_TOKEN/g) ?? []).length, 2);
  assert.equal(manifest.scripts["claude:prepare"], "node node_modules/@anthropic-ai/claude-code/install.cjs");
  const prepare = job.match(/- name: Prepare the pinned Claude CLI[\s\S]*?(?=\n\s+- name:)/)?.[0] ?? "";
  assert.match(prepare, /if: steps\.release-state\.outputs\.has_changesets == 'false'/);
  assert.match(prepare, /2\.1\.248/);
  assert.equal((prepare.match(/npm run claude:prepare/g) ?? []).length, 2);
  assert.match(prepare, /test -x node_modules\/\.bin\/claude/);
  assert.match(prepare, /realpath node_modules\/\.bin\/claude/);
  assert.doesNotMatch(prepare, /CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY/);
  assert.ok(job.indexOf("npm ci --ignore-scripts") < job.indexOf("Prepare the pinned Claude CLI"));
  assert.ok(job.indexOf("Prepare the pinned Claude CLI") < job.indexOf("Check whether a language model understands every example"));
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

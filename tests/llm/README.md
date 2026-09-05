# Release Checks for AI Understanding

The actual LLM tests live in each example's `eval/` directory. This directory
contains checks for the release workflow, not example questions or answers.
See the [semantic testing guide](../../packages/testing/README.md) for writing
and organizing cases.

## Run One Example

```sh
cd examples/tool-server
npm run test:llm
```

This command uses a real Claude model. Ordinary tests remain separate and run
with `npm test`.

## Run All Examples Locally

From the repository root:

```sh
npm run claude:prepare
npm run claude:login
npm run test:eval
```

Skip the login command if Claude is already signed in. Preparation makes the
pinned CLI executable; it does not sign in or run model tests.

## Release Requirements

GitHub runs `npm run test:eval:ci` with the pinned Claude CLI and
`claude-sonnet-4-6`. Its OAuth secret reaches only the model process, not the
example server or publishing job.

Each test needs three fresh answers and three independent judgments of each
answer. Failed answers are not retried. Missing facts, missing MCP calls, or a
failed judgment block publication. Every model call has a time limit.

Only checks on the revision being released approve publication. Local checks
do not substitute for this release check. Each example writes a redacted report
to `artifacts/llm-eval/evidence.json`; GitHub retains these reports for 14 days.

Separate copied-example smoke tests use `--smoke --model-command` with a fake
model to check installation and test wiring. Those smoke tests do not prove
real-model understanding and cannot approve a release.

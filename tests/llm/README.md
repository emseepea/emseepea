# Language-Model Understanding Checks

Promptfoo checks whether a language model understands every example. Each
example gets three fresh answers and three independent reviews. The test also
checks important facts and records which MCP operation supplied the data. The
model receives the question and result, but it cannot call MCP tools itself.

Prepare the pinned Claude CLI, then run the local check after signing in:

```sh
npm run claude:prepare
npm run claude:login
npm run test:eval
```

The preparation command makes the locked Claude CLI executable. It does not
sign in or run the language-model check.

The local check uses the Claude CLI account already signed in on your computer.
The repository does not read or store that account's credentials. GitHub uses
the repository's Claude OAuth secret instead.

Skip `npm run claude:login` when Claude is already signed in on your computer.

GitHub Actions runs `npm run test:eval:ci` with the pinned Claude CLI and
`claude-sonnet-4-6`, using the repository's Claude subscription secret. Only a
passing check for the code being released permits publication. Redacted results
are written under `artifacts/llm-eval/`. The local result records whether files
have uncommitted changes. Promptfoo does not retry a failed answer, and every
Claude call has a time limit.

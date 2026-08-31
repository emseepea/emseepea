---
"@emseepea/testing": minor
---

Write AI understanding tests in JavaScript instead of YAML. Tests can use setup
hooks, several MCP calls, generated cases, and custom assertions.

Move cases into an `eval/` directory and run `emseepea-test eval`. Ordinary
tests stay in `test/`. The runner finds nested test files automatically.

YAML cases are no longer supported. Use `semanticTest` from
`@emseepea/testing/semantic` to migrate them. Each case still requires three
fresh answers and nine independent judgments. Promptfoo is no longer a
dependency.

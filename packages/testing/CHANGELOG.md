# @emseepea/testing

## 0.1.0

### Minor Changes

- [#13](https://github.com/windyroad/emseepea/pull/13) [`a53f874`](https://github.com/windyroad/emseepea/commit/a53f8748bf5c8e8751e54c061c61eab6b8d19d46) Thanks [@tompahoward](https://github.com/tompahoward)! - Write AI understanding tests in JavaScript instead of YAML. Tests can use setup
  hooks, several MCP calls, generated cases, and custom assertions.
  
  Move cases into an `eval/` directory and run `emseepea-test eval`. Ordinary
  tests stay in `test/`. The runner finds nested test files automatically.
  
  YAML cases are no longer supported. Use `semanticTest` from
  `@emseepea/testing/semantic` to migrate them. Each case still requires three
  fresh answers and nine independent judgments. Promptfoo is no longer a
  dependency.

## 0.0.2

### Patch Changes

- [`d2722a1`](https://github.com/windyroad/emseepea/commit/d2722a173174ddeb11b3d17e26bd7ce8843c8ce5) Thanks [@tompahoward](https://github.com/tompahoward)! - Fix both public packages so they include the files needed to run them. Version
  0.0.1 omitted those files and should not be used.

## 0.0.1

### Patch Changes

- [`99eacdb`](https://github.com/windyroad/emseepea/commit/99eacdb00d2af5c8ed3191501d300a2f3d0c45ac) Thanks [@tompahoward](https://github.com/tompahoward)! - Add the public testing package and example-owned quality checks. Examples now
  carry their own deterministic tests, lint command, and semantic eval file.

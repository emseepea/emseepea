# Current Release Readiness

Date: 2026-10-13

## Release status

Publication status: **NOT READY**.

The #157 source implementation and focused package checks pass. Publication
remains pending until the final source commit passes the repository's Quality,
Release, Publish, registry, installed-package, merge-back, and clean-checkout
gates.

The repository's release verifier requires the next two machine-readable
markers. They record only the current source review result; they do not mean
that the package is published.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Local focused verification: **PASS**.
- Cognitive-accessibility review: **PASS** for the recorded source hashes.
- Release-risk review: required for the final source commit before release.

## Bounded Codex diagnostic evidence

`@emseepea/testing` now retains fixed diagnostic categories for failed Codex CLI
runs: authentication, configuration, host storage, permission or sandbox,
provider, transport, and unknown. The runner inspects at most 32 KiB of standard
error to choose the category, then discards the raw text.

Forbidden native items retain only capped counts from a fixed item-type list.
The evidence excludes commands, arguments, results, paths, server and tool
names, unknown item-type strings, credentials, endpoints, and fixture content.

The Codex invocation continues to disable local execution features and reject
forbidden native items during parsing. Successful native MCP conversations,
advertised-tool enforcement, failed-call rejection, trial checks, judge checks,
timeouts, token handling, and cancellation behavior remain unchanged.

## Planned package set

- `@emseepea/testing@0.23.2`

## Verified before push

The focused `@emseepea/testing` package suite passed 74 tests, including
one-shot Codex failure categories, resumed conversation failure categories,
bounded forbidden-item counts, private diagnostic exclusion, credential
redaction, and existing native MCP parsing behavior.

`decisions:check` passed. The public Markdown changed by #157 passed
cognitive-accessibility review for the recorded source hashes.

## Required release evidence

The final source commit must pass remote Quality. The release candidate must
then pass semantic qualification, publication under npm `next`, registry
integrity, signatures, provenance, and downloaded-package checks. Publish must
promote the exact candidate to `latest` and merge it back to `main`.

An independent clean installation of the published package must verify that
failed Codex runs expose only the bounded category, forbidden native items expose
only capped counts, and private diagnostics are not retained.

Only that published-package evidence can complete #157.

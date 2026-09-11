# Problem 002: Retrospective diagnostics are not self-resolving in adopter repositories

**Status**: Open
**Reported**: 2026-09-11
**Priority**: 10 (High) - Impact: Minor (2) x Likelihood: Almost certain (5)
**Effort**: M
**WSJF**: 5.0
**Origin**: internal

## Description

The retrospective workflow does not reliably explain or resolve its diagnostic
environment when it runs in an adopter repository. Maintainers must discover
installed plugin paths and measurement boundaries manually before they can
interpret the results.

The observed PATH failure, the separate measurement boundaries, and the
missing-`docs/rfcs` advisory are distinct observations. They are not evidence
of one shared root cause, and project-local zero values are not necessarily
incorrect.

## Symptoms

- Five `wr-retrospective-*` diagnostic commands initially failed with exit 127
  because the installed plugin's `bin` directory was not on `PATH`.
- After adding that directory for the command, the diagnostics succeeded.
- The cheap context helper reported project-local Hooks and Skills as zero,
  while plugin decomposition separately reported installed-plugin bytes.
- The legacy RFC advisory exited 2 when `docs/rfcs` was absent and failed open.

## Workaround

Invoke diagnostics through the installed retrospective plugin's `bin`
directory, report project-local and installed-plugin measurements as separate
boundaries, and treat the missing-`docs/rfcs` result as an unavailable advisory.

## Impact Assessment

- **Who is affected**: Maintainers running retrospective diagnostics in adopter
  repositories.
- **Frequency**: Every invocation in an environment where plugin command shims
  are not already on `PATH` or optional governance directories are absent.
- **Severity**: Minor because the failure interrupts local governance tooling
  without changing released artifacts or adopter runtime behavior.
- **Analytics**: The 2026-09-11 retrospective observed five initial exit-127
  failures before command-local PATH resolution.

## Root Cause Analysis

### Preliminary Evidence

The diagnostics are installed with the retrospective plugin rather than the
adopter repository. Different helpers intentionally measure different scopes.
Investigation must determine whether command resolution, boundary labeling, and
optional-directory handling need independent fixes or one shared invocation
contract.

### Investigation Tasks

- [ ] Determine why installed diagnostic commands are not resolved directly.
- [ ] Verify and document each helper's aggregation boundary.
- [ ] Define expected behavior when optional `docs/rfcs` is absent.
- [ ] Create reproduction tests for the confirmed failure paths.
- [ ] Create an INVEST story for each permanent fix path that remains distinct.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- [Context analysis](../../retros/2026-09-11-context-analysis.md)
- [Keep guidance accurate](../../jtbd/framework-maintainer/JTBD-102-keep-guidance-accurate.proposed.md)

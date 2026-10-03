# Current Release Readiness

Date: 2026-10-03

This plan covers scripted native form-confirmation input in semantic tests.
It is not a publication, client compatibility, or production claim.

## Planned Package Set

The generated Changesets plan contains one public release:

- `@emseepea/testing@0.19.0`

No server, feedback, UI, or initializer package release is planned. References
to testing in development dependencies do not add packages to this plan.

Version `0.18.0` was already staged from earlier source. Its immutable package
and provenance remain unchanged. The source baseline now reflects that occupied
version; the retained minor changeset plans a fresh `0.19.0` release containing
scripted confirmations and explicit alternative tool-sequence assertions.
This replacement still requires normal publication and registry verification.

## Behaviour and Evidence

Tests can provide explicit responses to matching native form-confirmation
requests through `chat.send(prompt, { elicitations })`. Unexpected, ambiguous,
repeated, or unused scripts fail. URL requests are not supported. There is no
default approval. Retained confirmation evidence redacts known configured
credentials; arbitrary secrets placed in test content are not detected.

The source implementation and README are committed at
`ae3a327cfc7688c5c7f9f246120c7574d746f454`.
The dependency and release-gate repairs are committed at
`3a1fe87c6ab4814dc6829f770dc40e6996c88ca8`. Its exact-commit clean-install
qualification passed. Local evidence for the implementation includes:

- Exact-commit clean-install qualification and the full `npm test` passed.
- All 17 focused confirmation helper and provider tests passed.
- All 47 built testing-package tests passed.
- Build, typecheck, and lint passed.
- One real pinned Claude 2.1.248 trial completed a contact confirmation against
  the actual VODER write handlers, with synthetic provider and database state.
  Its explicit fixture accepted the form and produced exactly one synthetic
  contact write. No real accounting record or email was changed.

Architecture and README cognitive accessibility reviews passed. The release
note passed voice/tone and confidential-information reviews. The observed
native Claude trial is not three-trial VODER semantic qualification, actual
human consent, native ChatGPT evidence, or production verification. Those
journeys remain outstanding and are not prerequisites for claiming only this
bounded testing API.

The exact source Quality run is
[37091806885](https://github.com/emseepea/emseepea/actions/runs/37091806885).
Its dependency-security job passed with two visible unpatched development
dependency findings. The proposed vulnerability-fix eligibility decision
permits those findings because no published fix is available. This is not a
clean dependency scan. Successful completion of the entire source Quality run
is required before this metadata may be committed.

## Required Publication Evidence

- Pass the exact source Quality run before committing this metadata slice.
- Qualify the exact metadata commit and pass its watched Quality run.
- Confirm the release pull request contains only the generated package plan.
- Pass applicable release risk and publication gates.
- Verify the exact npm package version, package contents, and provenance.
- Exercise the published confirmation API before reporting package verification.

## Review Status, Not Release Status

The labels below describe conditional readiness, not publication or deployment.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE.

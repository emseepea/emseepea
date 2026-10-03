# Current Release Readiness

Date: 2026-10-03

This plan covers scripted native form-confirmation input in semantic tests.
It is not a publication, client compatibility, or production claim.

## Planned Package Set

The Changesets plan covers the testing package and all eleven initializer
templates that include it:

- `@emseepea/testing@0.20.0`
- `@emseepea/create-tool-server@0.1.2`
- `@emseepea/create-api-backed-server@0.1.2`
- `@emseepea/create-openapi-backed-server@0.1.2`
- `@emseepea/create-resources-and-prompts-server@0.1.2`
- `@emseepea/create-progress-streaming-server@0.1.2`
- `@emseepea/create-html-ui-server@0.1.2`
- `@emseepea/create-react-ui-server@0.1.2`
- `@emseepea/create-multi-instance-postgres-server@0.1.2`
- `@emseepea/create-database-schema-server@0.1.2`
- `@emseepea/create-mongodb-backed-server@0.1.2`
- `@emseepea/create-soap-backed-server@0.1.2`

No server, feedback, UI or website package release is planned.

Testing versions `0.18.0` and `0.19.0` are already occupied. Their immutable
packages and provenance remain unchanged. Version `0.19.0` was published under
`next`, but downloaded-package verification failed: the published tool-server
initializer still installed testing `0.17.1`, while its source template expected
`0.18.0`. That candidate was not promoted.

The source baseline now reflects `0.19.0`. The retained minor changeset plans
fresh testing `0.20.0`; a paired patch changeset releases the eleven updated
initializer templates as `0.1.2`. Normal versioning updates their testing pins
to the planned testing version. The installed-version assertion stays intact.
This repair requires fresh qualification and normal publication verification.

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

The preceding source Quality run
[37109235141](https://github.com/emseepea/emseepea/actions/runs/37109235141)
passed on attempt 2. Its first attempt exceeded the transient-allocation budget;
the unchanged failed job passed on rerun. Release verification run
[37110502567](https://github.com/emseepea/emseepea/actions/runs/37110502567)
failed on attempt 2 at the downloaded quickstart's installed-version assertion.
Neither run verifies this new paired repair.

The dependency-security gate previously passed with two visible unpatched
development dependency findings. No third-party dependency version changes in
this repair. The proposed vulnerability-fix eligibility decision permits
unpatched findings when no published fix is available; this is not a clean scan.

## Required Publication Evidence

- Qualify the exact repair commit and pass its watched source Quality run.
- Confirm the release pull request contains only the generated package plan.
- Pass applicable release risk and publication gates.
- Verify the exact npm package version, package contents, and provenance.
- Exercise the published confirmation API before reporting package verification.

## Review Status, Not Release Status

The labels below describe conditional readiness, not publication or deployment.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE.

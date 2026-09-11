---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
---

# npm Scripts as the User-Facing Command Contract

> Captured via `/wr-architect:capture-adr`. Tom Howard ratified this command
> contract on 2026-09-11.

## Context and Problem Statement

Em See Pea examples and generated projects document routine commands for
building, starting, testing, linting, generating code, managing local databases,
and, soon, building containers. Requiring users to remember the underlying tool
and its flags makes the documentation itself the only command contract. Commands
then drift between examples, package manifests, and guides.

npm is already required by every project. Its package scripts can give routine
operations stable, discoverable names without adding another task runner.

## Decision Drivers

- Users should not need to memorise underlying tool commands or flags.
- One project-local contract should serve terminals, documentation, and
  continuous integration.
- Generated projects must remain standalone and cross-platform.
- Destructive operations must be named honestly.
- Bootstrap and external-account commands do not belong inside a project script.
- New scripts should represent documented operations, not speculative aliases.

## Considered Options

1. **npm scripts are the user-facing command contract (chosen)** - Document
   routine project-local operations through stable package scripts and keep the
   underlying commands inside `package.json`.
2. **Document underlying commands directly** - Require readers and automation to
   repeat Docker, Compose, compiler, test-runner, and generator invocations.
3. **Add a separate task runner** - Introduce another tool and configuration
   layer to centralise commands.

## Decision Outcome

Chosen option: **"npm scripts are the user-facing command contract"**, because
npm already provides the smallest common command surface across every example
and generated project.

Every routine documented project-local build, start, test, lint, code-generation,
database-lifecycle, and container operation is invoked through a script in that
project's `package.json`. `npm start` and `npm test` remain the standard aliases
for their corresponding npm scripts; other operations use
`npm run <script-name>`.

The following are not project-local routine operations and remain direct
commands:

- `npm init`, which creates the project;
- `cd`, which enters it;
- `npm install`, which bootstraps dependencies and creates its lockfile;
- external account or credential setup such as `claude auth login`; and
- underlying commands shown specifically for troubleshooting.

Raw tool commands may appear as package-script implementations or clearly
labelled troubleshooting details. Routine public instructions use only the npm
contract.

The container build contract is identical in every generated initializer:

```json
"container:build": "docker build --tag emseepea-server:local ."
```

The script owns the Docker invocation, default Dockerfile, build context, and
stable local image tag. There is no `container:run` script because safe runtime
configuration depends on the operator's proxy, addresses, and secret provider.
There is no initializer `container:check` script; repository continuous
integration may keep its qualification harness at the root.

Database examples expose:

```text
npm run db:start
npm run db:reset
```

`db:start` owns `docker compose up --detach --wait database`. `db:reset` owns the
destructive `docker compose down --volumes` operation; its name and documentation
must make data removal explicit. A database example's `dev` script composes these
npm scripts instead of repeating their underlying Compose commands.

No script is added for an operation that public project documentation does not
offer.

## Consequences

### Good

- Users learn stable task names instead of tool-specific flags.
- Documentation, generated projects, and automation share one executable
  command contract.
- Underlying commands can change without rewriting every routine instruction.
- npm remains the only task runner.
- Destructive database reset is visible in the command name.

### Neutral

- Bootstrap and external-account setup remain direct commands.
- Maintainers can still use raw commands while troubleshooting.
- Script names become part of the generated-project interface.

### Bad

- Every maintained example must keep the shared routine script names aligned.
- A reader must inspect `package.json` to see the underlying tool invocation.
- Very small one-command operations still gain an npm alias.

## Confirmation

- Every generated initializer manifest contains exactly
  `"container:build": "docker build --tag emseepea-server:local ."` when
  container support is introduced.
- Routine public documentation calls `npm run container:build` and contains no
  raw `docker build` or `docker run` instruction.
- Database examples expose `db:start` and `db:reset`; their `dev` scripts compose
  npm scripts rather than repeat Docker Compose commands.
- Documentation describes `db:reset` as deleting the local database volume
  before the command is run.
- Existing build, start, test, lint, and generation instructions use their
  project scripts.
- Automated documentation checks fail when a routine public instruction bypasses
  an available npm script or a required generated-project script is absent or
  inconsistent.
- No second task runner or speculative script is added.

## Pros and Cons of the Options

### npm Scripts Are the User-Facing Command Contract

- Good, because npm is already present and package scripts are executable,
  project-local documentation.
- Bad, because script names and manifests require coordinated maintenance.

### Document Underlying Commands Directly

- Good, because readers see each tool invocation without indirection.
- Bad, because flags are repeated, easier to mistype, and harder to change
  consistently.

### Add a Separate Task Runner

- Good, because a specialised runner could provide richer composition.
- Bad, because current operations do not justify another dependency or command
  language.

## Reassessment Criteria

Reassess if npm stops being common to every generated project, package scripts
cannot express a required cross-platform operation without substantial wrapper
code, or repeated script composition demonstrates a concrete need for a
different task runner.

## Related Decisions

- A following decision will govern the container base-image family and refresh
  policy.
- The safe-container decision will depend on this user-facing command contract
  and the base-image policy before implementation.

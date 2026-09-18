---
status: "proposed"
date: 2026-09-18
human-oversight: confirmed
oversight-date: 2026-09-18
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2026-12-18
---

# Opt-In Check Policy Modules for Adopter Contracts

## Context and Problem Statement

The published-contract command owns the reusable lifecycle for extracting a
current Model Context Protocol (MCP) contract, discovering stored baselines,
reporting compatibility failures, protecting authentication tokens, and
returning stable exit codes. By default, `check` accepts only the current
baseline envelope—the required JSON structure that wraps a stored contract—and
applies Em See Pea's built-in compatibility rules.

An established adopter has a retained marketplace baseline that predates that
envelope. Its confirmed compatibility policy also normalizes current and stored
contracts, requires exact schema-type stability, and permits additive output
fields that the stock comparator reports as breaking. The released command
therefore exits 2 before the adopter's migration or comparison policy can run.
The adopter must retain an entire local command wrapper even though directory
discovery, extraction, diagnostics, redaction, and exit handling are generic.

The existing boundary remains correct: legacy migration, custom normalization,
and comparison semantics are adopter-owned through the lower-level API.
Baseline retention, approvals, capture timing, and deployment policy are also
adopter-owned. This decision determines the smallest command extension that
lets an adopter supply those policies without taking over the generic command
lifecycle.

## Decision Drivers

- Preserve the current command's behavior for every adopter that does not opt
  in.
- Let an adopter migrate a parsed legacy baseline before the standard envelope
  validation would reject it.
- Let an adopter normalize current and stored contracts and apply its own
  comparison semantics through the existing lower-level API.
- Keep sorted baseline discovery, contract extraction, authentication, token
  redaction, diagnostic formatting, and exit-code selection in the command.
- Keep executable adopter code explicit and local rather than silently loading
  configuration.
- Avoid a general plugin system, a policy language, or separate lifecycle
  hooks without an evidenced need.
- Preserve the application boundary for retention, approvals, capture timing,
  baseline writes, and deployment decisions.

## Considered Options

1. **One opt-in check policy module (chosen)** - Add one `check`-only module
   option whose fixed export receives the extracted current contract and the
   ordered parsed baseline files, then returns standard compatibility-break
   records.
2. **Keep only the lower-level API** - Require every adopter with legacy or
   custom policy to retain its complete local command wrapper.
3. **Add separate migration, normalization, and comparison hooks** - Expose a
   hook for each policy stage and define their ordering and intermediate types.
4. **Add a declarative policy file** - Describe migration, normalization, and
   comparison rules in a new configuration language.
5. **Broaden the default validator and comparator** - Make legacy envelopes or
   adopter-specific compatibility rules part of the stock command behavior.

## Decision Outcome

Chosen option: **"One opt-in check policy module"**, because one structured
boundary removes the duplicated command lifecycle while leaving each adopter's
compatibility meaning in its own executable code.

The `check` command will accept this explicit option:

```text
emseepea-contract check ... --policy ./published-contract-policy.mjs
```

The path resolves as a local ECMAScript module. The module exposes one fixed
named function with this public contract:

```ts
type PublishedMcpContractBaselineInput = Readonly<{
  file: string;
  value: unknown;
}>;

function checkPublishedMcpContracts(input: Readonly<{
  current: PublishedMcpContract;
  baselines: readonly PublishedMcpContractBaselineInput[];
}>):
  | readonly PublishedMcpContractBreak[]
  | Promise<readonly PublishedMcpContractBreak[]>;
```

`current` is the already-extracted contract. The command obtains it through its
existing extraction mechanisms, whether it loads the application through a
factory module or reads from a URL. `baselines` preserves the command's sorted
discovery order. Each entry contains the resolved file identity and its parsed
JSON value before the standard baseline-envelope validation. This is the
earliest useful boundary for legacy migration while keeping directory
discovery, file reading, and JSON parsing in the command.

The policy function owns only migration, normalization, and comparison. It may
convert legacy values to `PublishedMcpContractBaseline`, normalize the current
and stored contracts, call the lower-level comparison API, and add or filter
structured break records. It does not receive the authentication token or
command-control callbacks.

The command validates the returned value as an array of
`PublishedMcpContractBreak` records whose `version`, `kind`, `path`, and
`detail` fields are strings. An empty array means compatible and returns exit
0. One or more valid break records use the command's existing compatibility
diagnostic format and return exit 1. Module import failures, thrown policy
errors, malformed return values, baseline JSON errors, and extraction failures
are command failures; their command-managed diagnostics are token-redacted and
return exit 2.

Without `--policy`, the command keeps the current envelope validation,
comparison semantics, messages, discovery order, and exit statuses. The option
is rejected for `capture`; this decision adds no capture hook and no automatic
baseline migration or rewrite.

A policy module is trusted adopter code and runs with the same operating-system
and process authority as the command, just as an application factory module
does. The command redacts secrets from errors it formats, but it cannot prevent
a trusted module from reading process state, writing files, or writing directly
to standard output. Documentation must state this boundary and must not present
the option as a sandbox.

## Consequences

### Good

- Established adopters can use the shared command lifecycle while preserving
  retained legacy baselines and confirmed local compatibility rules.
- Existing adopters see no behavior change unless they add `--policy`.
- One function and one return type cover the evidenced migration,
  normalization, and comparison needs without a framework-wide plugin system.
- Structured break records let the command retain consistent diagnostics and
  exit-code behavior.
- The policy receives no command token or authority callback.

### Neutral

- A policy module is application code compiled or authored by the adopter and
  referenced from a project-local npm script.
- The module receives parsed values rather than validated current-envelope
  baselines because legacy migration must run before that validation.
- The module can reuse Em See Pea's lower-level types and comparator but is not
  required to use the stock semantics.
- This development command does not alter the deployed server request path, so
  no runtime-path performance budget applies.

### Bad

- The module option, fixed export, input shape, and break-record result become a
  supported public extension contract.
- Executable policy code has the command process's authority and cannot be
  sandboxed or prevented from producing its own unredacted output.
- The command must validate policy results and distinguish incompatibility from
  module or contract failure.
- An adopter can write an incorrect policy that weakens its own compatibility
  gate; Em See Pea can preserve the ownership boundary but cannot validate the
  adopter's policy meaning.

## Confirmation

Implementation and delivery require all of these checks:

- Running `check` without `--policy` preserves the existing accepted inputs,
  sorted discovery, baseline validation, comparison results, diagnostics, and
  exit statuses.
- `--policy` is accepted only by `check`, resolves one local module, and requires
  the fixed `checkPublishedMcpContracts` export.
- A focused policy fixture receives an extracted current contract and ordered
  `{ file, value }` entries, migrates a legacy baseline envelope, normalizes both
  sides, and applies custom comparison semantics without reading the baseline
  directory or controlling the process.
- An empty structured result returns exit 0. Valid break records use the
  command's compatibility diagnostic format and return exit 1.
- Import failure, a missing export, a thrown error, or any malformed result is
  reported as a command failure and returns exit 2.
- Token-sentinel tests prove the command does not pass the token to the policy
  input and redacts it from every error the command formats, including a policy
  error. Documentation states that direct output from trusted module code is
  outside that guarantee.
- Capture behavior and baseline files remain unchanged; no migration result is
  written automatically.
- Public documentation keeps baseline retention, approvals, capture timing,
  release decisions, and deployment policy application-owned.
- The evidenced adopter can replace its command-lifecycle wrapper while keeping
  its local migration, normalization, exact-type, additive-output, retention,
  approval, and deployment rules.
- Source and package checks confirm the module contract separately from npm
  publication or adopter deployment. Those later outcomes require their own
  named evidence and make no production-verification claim by themselves.
- This decision must be ratified before implementation begins.

Requested action: Tom Howard should ratify or reject this proposed decision.
Implementation must not begin until ratification.

## Pros and Cons of the Options

### One Opt-In Check Policy Module

- Good, because one boundary covers the complete evidenced policy need while
  leaving generic command work in the command.
- Good, because structured break records preserve common diagnostics and exit
  codes.
- Bad, because executable modules create a versioned public trust boundary.

### Keep Only the Lower-Level API

- Good, because it adds no public command option or extension contract.
- Bad, because an adopter with any custom policy must duplicate discovery,
  extraction, diagnostics, redaction, and exit handling.

### Add Separate Migration, Normalization, and Comparison Hooks

- Good, because each transformation stage would be independently replaceable.
- Bad, because it adds multiple APIs, ordering rules, and intermediate contracts
  for one evidenced integration point.

### Add a Declarative Policy File

- Good, because data-only configuration is easier to inspect than executable
  code.
- Bad, because expressing legacy shape migration and schema-aware comparison
  would create and maintain a new policy language.

### Broaden the Default Validator and Comparator

- Good, because affected adopters would not need a module option.
- Bad, because unrelated adopters would inherit legacy and application-specific
  semantics that conflict with the current default contract.

## Reassessment Criteria

Reassess this decision if multiple adopters need the same policy and it can move
into the stock comparator without changing established behavior; if policies
need a second lifecycle phase that cannot be expressed by the single function;
if safe module isolation becomes a platform requirement; if a protocol or
package change makes raw parsed baselines or structured break records
insufficient; or if measured adopter use does not justify maintaining the
public extension contract.

## Related Decisions and Jobs

- [Canonical Public Contract and Private Manifest Compilation](0006-canonical-public-contract-and-private-manifest-compilation.proposed.md)
- [npm Scripts as the User-Facing Command Contract](0076-npm-scripts-as-the-user-facing-command-contract.proposed.md)
- [Migrate an Established MCP Server Safely](../jtbd/mcp-server-developer/JTBD-005-migrate-an-established-mcp-server-safely.proposed.md)
- [Evolve a Published MCP Contract Safely](../jtbd/mcp-server-developer/JTBD-006-evolve-a-published-mcp-contract-safely.proposed.md)

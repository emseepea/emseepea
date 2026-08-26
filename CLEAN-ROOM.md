# Clean-Room Boundary

## Purpose

Em See Pea is an independent implementation based on public standards, public
open-source dependencies, the approved implementation guide, and approved
amendments. This control is an engineering measure, not legal advice.

## Permitted Inputs

- `/Users/tomhoward/Projects/mcp-streamable-http-framework-implementation-guide.md`
- Approved amendments stored in this repository
- Public MCP specifications, schemas, SEPs, RFCs, and accessibility standards
- Maintained public open-source libraries selected through the dependency policy
- Independently created synthetic examples, fixtures, and tests
- Generic QA and release-process precedent explicitly authorized by the user and
  recorded separately in the provenance log

## Prohibited Inputs

- Any archived or restricted implementation
- Source, binaries, generated output, tests, fixtures, logs, manifests, or
  documentation originating from a restricted implementation
- Restricted identifiers, class names, strings, schemas, layouts, or algorithms
- Production-derived or domain-specific data
- Product source, test bodies, fixtures, schemas, MCP behavior, or domain rules
  from projects consulted only for QA-process precedent

## Working Rules

1. Use only this repository, the named guide, approved amendments, and public
   sources.
2. Record consulted sources and dependencies in
   [the provenance log](docs/provenance.md).
3. Turn ambiguities into observable requirements or acceptance scenarios.
4. Use synthetic names and data in examples and tests.
5. Stop the affected workstream after accidental exposure. Record what was
   exposed, quarantine affected artifacts, and obtain an independent assessment
   before resuming.
6. Do not claim clean-room qualification until an independent review passes.

## Current Attestation

As of 2026-08-26, implementation work has used only this fresh workspace, the
named guide, public sources, public package metadata, and system-provided working
instructions. No archived implementation was opened or restored.

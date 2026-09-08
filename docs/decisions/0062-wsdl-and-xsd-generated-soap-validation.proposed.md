---
status: "proposed"
date: 2026-09-08
human-oversight: confirmed
oversight-confirmed-date: 2026-09-08
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-08
---

# XSD-Generated SOAP Structure and Runtime Validation

## Context and Problem Statement

The examples need to show how an MCP server can expose an existing SOAP service
without hand-copying its contract into TypeScript validators. The WSDL must
remain authoritative for SOAP operations, and the XSD must remain authoritative
for backend types and runtime validation, while the MCP keeps its own small,
well-described public schema.

## Decision Drivers

- Generate the backend structure that TypeScript can express from the service
  XSD.
- Validate raw SOAP XML against the service XSD before mapping parsed values.
- Preserve required fields, optional fields, arrays, and primitive categories in
  generated TypeScript.
- Preserve namespaces and relevant XSD restrictions in the generated schema
  model used for runtime validation.
- Keep public MCP schemas separate and useful to a model.
- Use open-source tools instead of building an XML or WSDL parser.
- Bound XML size, external references, time, and error disclosure.

## Considered Options

1. **SOAP client plus shared XSD generation and validation**: use `soap` for
   WSDL operations and `xml-xsd-engine` to generate TypeScript and validate raw
   XML from the same locally resolved XSD graph.
2. **Generated WSDL client plus a separate XSD validator**: use
   `wsdl-tsclient` for TypeScript and `xmllint-wasm` for runtime validation.
3. **SOAP client with hand-written Zod backend schemas**: use the WSDL for calls
   but duplicate response shapes in Zod.
4. **Project-owned WSDL and XSD generator**: implement contract parsing and
   TypeScript generation inside the example.
5. **Cerios generated decorators and serializer**: replace the schema engine
   with `@cerios/xml-poto-codegen` and `@cerios/xml-poto`.

## Decision Outcome

Chosen option: **"SOAP client plus shared XSD generation and validation"**,
because one XSD graph can precisely generate backend types and govern runtime
acceptance without creating a generator inside Em See Pea.

The public package is `@emseepea/create-soap-backed-server`, maintained in
`examples/soap-backed-server`. `soap` reads the local WSDL and performs the SOAP
call. `xml-xsd-engine` loads an allowlisted graph of local XSD files. That exact
resolved graph generates TypeScript and validates the raw response at runtime.
A custom bounded transport rejects oversized, DTD-bearing, entity-bearing,
malformed, or XSD-invalid XML before the `soap` parser receives it. The locally
committed application-specific SOAP-envelope schema imports the locally
committed service XSD and requires the expected service response element. The
committed WSDL imports that same service XSD. Generated files are checked in so
normal installation, offline generation, and builds do not fetch remote
contracts.

Generated mapper input and output types preserve the structural facts that
TypeScript can express: required versus optional properties, scalar versus
array shape, and primitive categories such as `number` versus `string`.
Namespace identity and XSD value facets such as `xs:positiveInteger`, string
length limits, and occurrence counts are runtime guarantees preserved in the
generated schema model and enforced from the same resolved XSD graph. Ordinary
TypeScript types do not claim to encode those facets. Mappers compile against
the generated types without casts or hand-written duplicate backend
interfaces.

Cerios was evaluated in a disposable spike and rejected for this fixture. It
accepted a wrong response namespace, accepted zero and fractional values for
`xs:positiveInteger`, exposed no whole-document resource limits, and generated
an extensionless operations import that failed NodeNext compilation.

The runtime rejects DTDs, entity declarations, non-allowlisted schema imports,
oversized XML, invalid XML, XSD-invalid responses, timeouts, redirects outside
the configured origin, and SOAP faults with a generic public failure. The
backend destination is fixed. A bounded transport rejects a response larger
than 64 KiB before full buffering. Public MCP input and output remain described
Zod schemas that expose only the fields useful to the model.

XSD validation concurrency is one. Network traffic is bounded to 128 KiB per
call. CPU and memory use are measured before release and become the enforced
budgets; no unmeasured lower resource claim is made. At the assumed maximum of
1,000 calls per day, the network ceiling is 128 MiB per day.

## Consequences

### Good

- Structural XSD changes produce reviewable generated TypeScript changes and
  runtime validation changes.
- Value-facet-only changes produce reviewable schema-model and runtime
  validation changes without pretending that ordinary TypeScript expresses
  those facets.
- Runtime validation checks the actual XML contract before mapping.
- The example teaches a light adapter around a legacy service rather than a
  replacement service layer.

### Neutral

- The WSDL defines SOAP operations while its imported XSD defines data shapes.
- Generated code and local service-contract fixtures are committed.

### Bad

- SOAP calls and XSD processing require two dependencies.
- `xml-xsd-engine@1.7.3` is MIT licensed and declares no runtime dependencies,
  but its unpacked npm package is approximately 2.8 MB and its security and
  performance claims require independent qualification.

## Confirmation

- The same committed local XSD graph drives TypeScript generation and runtime
  XML validation.
- Compile-time fixtures using the generated request and response types prove
  required fields cannot be omitted, optional fields may be omitted, `trait` is
  an array, and `daysToMaturity` is a number rather than a string.
- Namespace identity is preserved in the generated schema model and proven by
  runtime acceptance and rejection tests.
- Runtime tests accept a positive integer, a 1-to-40-character pea type, zero to
  five traits, and an omitted optional note. They reject zero, a negative
  integer, a fractional number, a non-number, empty and over-40-character pea
  types, six traits, a missing required field, and a wrong namespace.
- Mapper input and output compile against generated types without casts or
  hand-written duplicate interfaces.
- A clean offline generation produces no diff.
- Clean generation succeeds with network access disabled and remote WSDL or XSD
  resolution is impossible.
- Changing an XSD primitive type changes generated TypeScript and runtime
  acceptance. Changing only a value facet changes runtime acceptance and the
  generated schema model but need not change the TypeScript interface.
- A compatibility test proves the custom transport validates the raw response
  before parsing and never invokes the SOAP parser for an oversized,
  DTD-bearing, entity-bearing, malformed, or XSD-invalid response.
- Tests cover a successful call, SOAP fault, invalid XML, XSD-invalid XML,
  DTD and entity rejection, oversized response before full buffering, timeout,
  cross-origin redirect, fixed destination, and blocked external schema
  resolution.
- Invalid, malformed, oversized, timed-out, redirected, or externally resolving
  responses never reach the SOAP parser or mapper.
- Tests independently prove the parser's external-entity and resource limits
  instead of accepting dependency claims as evidence.
- OSV, licence, software-bill-of-materials, provenance, and packed standalone
  checks cover `soap` and `xml-xsd-engine`.
- Semantic tests prove natural tool selection and answer meaning without adding
  MCP hints to model context.
- The initializer creates a private standalone project and passes ordinary,
  semantic, package, provenance, registry, accessibility, and documentation
  gates.
- Qualification measures process CPU and memory before release and records
  enforced limits.

## Pros and Cons of the Options

### SOAP Client plus Shared XSD Generation and Validation

- Good: One resolved XSD graph governs compile-time and runtime checks.
- Bad: The schema engine needs independent compatibility, security, and
  performance qualification.

### Generated WSDL Client plus a Separate XSD Validator

- Good: Each tool focuses on one established task.
- Bad: The tested WSDL generator made required numeric fields optional strings,
  so generated TypeScript did not precisely follow the XSD.

### SOAP Client with Hand-Written Zod Backend Schemas

- Good: Zod matches the rest of the repository's runtime validation style.
- Bad: The copied backend schema can drift from WSDL and XSD.

### Project-Owned WSDL and XSD Generator

- Good: Em See Pea could control every generated shape.
- Bad: It creates a large maintenance surface unrelated to the framework's core
  purpose.

### Cerios Generated Decorators and Serializer

- Good: It emits readable decorator metadata for several XSD facets.
- Bad: It failed namespace, built-in numeric restriction, resource-bound, and
  NodeNext qualification for this fixture.

## Reassessment Criteria

Reassess if the schema engine cannot represent the fixture contract, introduces
unacceptable security or performance risk, or fails independent conformance
tests against the XSD features used by the example.

# Current Release Readiness

Date: 2026-09-08

## Release Batch

- `@emseepea/create-database-schema-server@0.0.1`
- `@emseepea/create-mongodb-backed-server@0.0.1`
- `@emseepea/create-soap-backed-server@0.0.1`
- `@emseepea/testing@0.5.3`

## Change for Users

The database-schema initializer generates checked-in TypeScript and runtime
validation from PostgreSQL. It prefers reads and writes through a view and
includes one stored procedure as a secondary pattern.

The MongoDB initializer shows two collection choices in one project. Pea
varieties use a MongoDB validator. Pea observations remain schemaless and are
validated by the application before writes and after reads.

The SOAP initializer keeps a local WSDL and XSD authoritative, generates
TypeScript from the XSD, validates bounded raw XML before parsing, and returns
small described JSON results.

## Local Evidence Before Publication

- Architecture review passed for ratified ADR-0060, ADR-0062, and ADR-0063.
- Jobs To Be Done, cognitive-accessibility, and Markdown accessibility reviews
  passed after implementation corrections.
- Generation checks, TypeScript compilation, lint, ordinary integration tests,
  package dry runs, website build, website accessibility tests, and initializer
  package-list checks passed.
- The first full packed-initializer run found a missing standalone
  `@types/sax` development dependency. After making it explicit, the repeated
  run created and checked all eleven standalone projects successfully.
- Every read, write, and procedure path ran five local performance trials with
  100 calls for application process CPU and 20 isolated calls for transient
  heap. PostgreSQL paths used 1.10 to 1.28 ms median mean CPU and 554 to 624 KiB
  median peak transient heap. MongoDB paths used 1.27 to 1.93 ms and 736 to 778
  KiB. The SOAP path used 2.01 ms and 567 KiB after its absolute deadline
  regression was added. A byte-counting TCP proxy found no more than 605 bytes
  of PostgreSQL traffic, 588 bytes of MongoDB traffic, or 1,149 bytes of SOAP
  traffic for any measured call. The largest serialized MCP request plus
  response was 1,010 bytes. SOAP also enforces 64 KiB in each direction.
  Measurements exclude operating-system work.

## Required Publication Evidence

- The repeated packed run must create all eleven projects outside the monorepo,
  install them, and pass lint, ordinary tests, and semantic smoke tests.
- Exact-commit Quality must pass Node.js 22 and 24, OSV, website, package,
  standalone initializer, and integration performance checks.
- The later release job must pass every provider-native semantic example before
  publication.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, clean installation, software bills of materials, and package
  evidence.
- The replaced SQLite initializer must be deprecated only after the PostgreSQL
  replacement remains published and verified.

## Review Status

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Publication has not yet occurred.

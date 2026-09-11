# `@emseepea/create-openapi-backed-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template when the JSON API you call has an OpenAPI 3 or Swagger 2
contract and you want generated TypeScript and Zod validation at the backend
boundary. Use the [API-backed server template](../api-backed-server/README.md)
when no usable machine-readable contract exists.

## Create a Project

```sh
npm init @emseepea/openapi-backed-server -- my-server
```

<!-- generated-project-readme -->

## OpenAPI-Backed Pet Lookup

The `get-pet` tool looks up one pet in
[Swagger Petstore](https://petstore3.swagger.io/) by a positive identifier.
The backend path parameters, response TypeScript declarations, and response
validator come from the committed OpenAPI contract. The public MCP input and
output remain separately described and bounded by the application.

The canonical contract is
[`contracts/petstore.openapi.json`](contracts/petstore.openapi.json). It was
retrieved on 11 September 2026 from the exact
[Swagger Petstore OpenAPI 3 endpoint](https://petstore3.swagger.io/api/v3/openapi.json)
at version `1.0.27`; the committed file has SHA-256
`f50a32e57d10018049bcd51c28bcb47f8e595563f7583cedaa9e7134376cec62`.

The corresponding
[upstream source at revision `d57941e`](https://github.com/swagger-api/swagger-petstore/blob/d57941e8fe959e508796b27469b1e8bba73392dc/src/main/resources/openapi.yaml)
identifies the contract as Apache-2.0 licensed.

The generation script accepts only local JSON Pointer references beginning
with `#/`. It rejects web and relative-file references before conversion and
again after Swagger 2 conversion. Generation, build, tests, start, and request
handling never fetch a contract.

## Generate Types and Validators

Edit the local contract, then regenerate and review the diff:

```sh
npm run generate
npm run generate:check
```

The checked-in files under `src/generated/` use `typed-openapi` with Zod 4,
strict validation, the `getPetById` operation filter, and no generated HTTP
client. Normal builds use these files without running the generator.

The local
[`test/fixtures/petstore.swagger.yaml`](test/fixtures/petstore.swagger.yaml)
proves the older Swagger 2 import path. It is converted to OpenAPI 3 and sent
through the same generator; it is not a second application template.

## Run

```sh
npm install
npm run build
npm start
```

The MCP endpoint is `http://127.0.0.1:3000/mcp`.
`PETSTORE_API_ORIGIN` can select an operator-controlled compatible endpoint;
when it is unset, the server uses Swagger Petstore.

## Build a production container

Run `npm install` first so the project has a lockfile. Then run:

```sh
npm run container:build
```

The image is for a production deployment behind a trusted proxy. It starts with
the fail-closed production profile and needs a runtime-mounted deployment
configuration file. Keep secrets in your platform's runtime secret store, not in
the Dockerfile, build arguments, or deployment configuration file.

For the production proxy, runtime configuration, and hardening requirements, see
the [container guide](https://emseepea.github.io/emseepea/examples/#build-a-production-container).

## Choose Open or Protected Access

The starter is open by default. To protect it, pass an `access` policy and an
`authentication` adapter to `createBackendExample`. The ordinary tests show
the protected composition.

## Check This Example

Run generation drift, build, mapping, validation, and MCP checks:

```sh
npm run generate:check
npm test
```

Run the language-model tool-choice and understanding check separately:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.

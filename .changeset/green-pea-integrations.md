---
"@emseepea/create-database-schema-server": patch
"@emseepea/create-mongodb-backed-server": patch
"@emseepea/create-soap-backed-server": patch
"@emseepea/testing": patch
---

Add initializer packages for schema-generated PostgreSQL integration, MongoDB
collections with and without database validation, and contract-validated SOAP
services.

Isolate stateful semantic-test server environments per answer trial and expose
captured server output for credential-safe integration assertions.

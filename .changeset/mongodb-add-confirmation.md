---
"@emseepea/create-mongodb-backed-server": patch
---

Confirm saved details after adding a MongoDB-backed pea variety

The `add-pea-variety` example tool now tells the AI to include the returned name, pea type, and days to maturity after a successful addition. Previously, the write could succeed while the answer omitted the pea type and maturity time.

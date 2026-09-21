---
"@emseepea/create-database-schema-server": patch
---

Confirm a newly added pea variety's saved details

The `add-pea-variety` example tool now tells the AI to include the returned name, pea type, and days to maturity when it confirms a successful addition. Previously, the write could succeed while the answer omitted the pea type and maturity time.

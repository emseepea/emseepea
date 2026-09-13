---
"@emseepea/server": patch
---

Allow static resources and resource templates to return multiple validated text
or binary content items. Each item's URI may differ from the URI of the
requested resource. Em See Pea still authorizes the requested resource, and any
cache instructions apply to the complete response.

Returning an item URI does not, by itself, register a resource or let a client
read that URI through Em See Pea. A client may still read it if the URI
separately identifies an already registered static resource or matches an
already registered resource template, and the client satisfies that
capability's access policy.

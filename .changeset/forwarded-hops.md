---
"@emseepea/server": minor
---

Read the forwarded client address by counting from the end, so a proxy that appends to `x-forwarded-for` can be read correctly

`production-behind-proxy` refused every request that arrived through a proxy which appends its own address after the client's. The check accepted a single entry and nothing else. An appending proxy always sends at least two, so it could not be put in front of a server in this mode. A proxy that replaces the header with the caller's address, leaving one entry, was already accepted and needs no change.

The production profile takes a new optional `forwardedHops`: how many entries the infrastructure in front appends after the client address. It defaults to `0`, which keeps the behaviour it had, so no existing configuration becomes invalid and no allowlist widens.

At `0` the header must carry the client and nothing else. That strictness is deliberate rather than legacy: with nothing trustworthy appending, a second entry can only have come from the caller, so the header is not evidence of anything and is refused rather than read.

At `1`, one proxy appends its own address after the client, and the client is the entry just before it. Anything earlier in the header was supplied by the caller and is ignored.

Counting from the end is the point of the change. Reading the first entry is the obvious way to accept a longer header and it is the wrong one, because the first entry becomes the rate-limit key: a caller who prepends a different value each time would never be limited. There is a test for exactly that, with a budget of one request, two calls differing only in the caller-supplied prefix, and the second refused.

Set the count from what your deployment actually sends, not from what a platform is documented to do. Log the raw `x-forwarded-for` from a request you make yourself, count the entries that appear after your own address, and use that number.

Both wrong values fail, in different ways. The dangerous one is a count higher than the truth.

A count higher than the truth moves the position being read into the part of the header a caller controls. A caller who prepends their own value is served, and the rate limit never catches them. Nothing reports it. Honest callers, whose header is shorter than the count expects, are refused instead, and that refusal is the only visible sign.

A count lower than the truth reads an address your own infrastructure appended as though it were the client. Every caller then shares one rate limit. That is wrong too, but you see it at once, because the limit starts applying to everyone together.

Counting from the end keeps a caller out of the key only while the count is right. Nothing in the framework detects a count that is too high.

The entries after the client are counted, not checked. The count on its own picks out the client address, so it has to match your deployment exactly.

Entries are trimmed before they are read. That matters most for a multi-entry header, because senders usually separate with a comma and a space, and address parsing rejects a value with a leading space. A single padded entry is accepted too.

This addresses the header shape only. A deployment whose proxy has no stable address still cannot satisfy `trustedProxyAddresses`, and that part of the report remains open.

Reported in #120.

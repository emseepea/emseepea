---
"@emseepea/server": minor
---

Let a proxy with no fixed address prove itself with a secret header

A server behind a load balancer with no stable address could not start in
`production-behind-proxy` mode. The profile required `trustedProxyAddresses`,
which takes literal addresses only, and platforms like Cloud Run behind an
external load balancer present nothing stable to list. The
server refused to start, the container never listened, and the deploy failed.

The profile now takes `proxyBoundary` instead: a header name and a secret. The
proxy is configured to add that header, and the server refuses any request
that does not carry it.

Supply exactly one of `trustedProxyAddresses` and `proxyBoundary`. A profile
with both is refused, and so is one with neither. The secret must be at least
32 characters, and the header cannot be a forwarding header.

The header check replaces the address check and changes nothing else. The
forwarded-protocol, authority, origin and rate-limit checks all still run.

Configure the header on the proxy first. Until the proxy is sending it, every
request is refused. A mistake here closes the server rather than opening it.
That is why the server checks a secret instead of trusting a setting.

The secret is a credential. Supply it from your platform's secret store rather
than the deployment file: the file names the environment variable holding the
value, so it stays non-secret policy. The value is compared in constant time,
and this package never writes it to a log or sends it to an observability
adapter. Rotate it as you would any other credential.

Check your own infrastructure too. The secret travels as a request header, and
proxies and CDNs often log request headers by default. Turn off logging for
that header at your proxy and anything in front of it.

Reported in #119.

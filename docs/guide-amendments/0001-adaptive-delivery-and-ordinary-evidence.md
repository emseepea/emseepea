# Guide Amendment 0001: Adaptive Delivery and Ordinary Evidence

- Status: Approved implementation input
- Date: 2026-08-26
- Applies to: MCP Streamable HTTP Framework clean-room implementation guide
- Guide SHA-256: `c7940e5bf26abe65915b996ebf0812fabb6f97d91567653a76018717a8e747de`

## Reason

The guide contains useful capability and safety coverage, but its fixed
110-iteration sequence and bespoke cryptographic qualification system prescribe
excess machinery. The product objective is complete, independently qualified
framework behavior, not fidelity to a speculative delivery sequence or a new
certification product.

## Amendment

1. Treat the 110 outcomes as a coverage ledger and dependency map, not mandatory
   release count or immutable order.
2. Deliver the smallest safe adopter-visible increment chosen from current
   evidence. Reorder, combine, or split work when dependencies, risks, or real
   adopter constraints justify it.
3. Retain the guide's protocol, validation, security, accessibility,
   cancellation, resource-bound, clean-room, and honest-claim requirements.
4. Remove the bespoke trust-root, verifier-challenge, evidence-envelope,
   historical-signature, revocation-registry, and paired-report machinery from
   the implementation target.
5. Replace `MCP1-FULL` with a revised full active server-surface claim defined by
   complete traceability to the authoritative public MCP `2026-07-28` server
   requirements and ordinary reproducible evidence.
6. During delivery, publish only exact composable capability and deployment
   claims. A full claim is unavailable until every active server-side
   requirement in scope has current passing evidence.
7. Use ordinary release integrity and review controls: locked dependencies,
   registry integrity hashes, checksums, software bills of materials,
   clean-checkout CI, independent client interoperability, and independent
   protocol, security, accessibility, architecture, and clean-room reviews.

## Precedence

The public MCP specification and official schema remain authoritative. This
amendment overrides conflicting delivery-order and bespoke-certification text in
the guide. Other guide requirements remain implementation inputs subject to the
precedence rule.

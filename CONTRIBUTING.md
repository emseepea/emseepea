# Contributing to Em See Pea

Em See Pea is pre-alpha. Small, focused changes with evidence at the public
boundary are welcome.

## Before Opening a Pull Request

1. Submit only material you have the right to license under MIT. Do not include
   secrets, customer data, confidential information, or incompatible third-party
   material.
2. Install from the committed lockfile with `npm ci --ignore-scripts`.
3. Run `npm test`, `npm run benchmark`, and `npm audit --audit-level=high`.
4. Add a Changeset for any user-visible change to `@emseepea/server`.
5. Update the exact capability claim when behavior changes and keep dependency
   licences valid.

Examples must consume public package APIs and remain private npm workspaces.
Security reports belong in the private channel described in
[SECURITY.md](SECURITY.md), not a public issue.

By contributing, you agree that your contribution is licensed under the MIT
License in [LICENSE](LICENSE).

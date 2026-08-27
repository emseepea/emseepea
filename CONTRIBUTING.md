# Contributing to Em See Pea

Em See Pea is pre-alpha. Small, focused changes with evidence at the public
boundary are welcome.

## Before Opening a Pull Request

1. Work only from public sources and synthetic data. Do not introduce archived,
   restricted, proprietary, or customer material.
2. Install from the committed lockfile with `npm ci --ignore-scripts`.
3. Run `npm test`, `npm run benchmark`, and `npm audit --audit-level=high`.
4. Add a Changeset for any user-visible change to `@emseepea/server`.
5. Update the exact capability claim and provenance when behavior or a source
   changes.

Examples must consume public package APIs and remain private npm workspaces.
Security reports belong in the private channel described in
[SECURITY.md](SECURITY.md), not a public issue.

By contributing, you agree that your contribution is licensed under the MIT
License in [LICENSE](LICENSE).

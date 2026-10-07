# Contributing to Em See Pea

Em See Pea is beta. See [maturity and support](SUPPORT.md#maturity-and-support)
for its limits. Small, focused changes with evidence at the public boundary
are welcome.

## Before Opening a Pull Request

1. Submit only material you have the right to license under MIT. Do not include
   secrets, customer data, confidential information, or incompatible third-party
   material.
2. For software changes, install from the committed lockfile with
   `npm ci --ignore-scripts`.
3. For software changes, run `npm test` and `npm run benchmark`.
4. Add a Changeset for any user-visible change to `@emseepea/server`.
5. Update the exact capability claim when behavior changes and keep dependency
   licences valid.

Install the repository-owned push hook once in each clone or worktree with
`npm run hooks:install`. Before pushing a branch tip, run
`npm run push:qualify`. Normally it runs `npm ci` and `npm test`, then records
evidence for the exact commit. The working tree must be clean, and the commit
must remain unchanged.

For operational documentation, qualification compares the fetched `origin/main`
commit with the commit being pushed. If that comparison changes only regular
`.md` files under `docs/briefing`, `docs/problems`, `docs/retros`, or
`docs/reviews`, it checks whitespace and verifies that documentation reviews
match the current content. This route needs no dependency install or Docker.
Other paths or an uncertain comparison require full qualification.

Documentation-only evidence is valid only for pushing to `origin/main` at the
checked base commit. To push a documentation branch for a pull request, use
`npm run push:qualify -- --full` to run the full checks.

Use `npm run push:watch` to push to `main` and watch its remote checks. Eligible
documentation-only Quality runs skip software checks and release preparation.
They do not authorize package publication.

Examples must consume public package APIs and remain private npm workspaces.
Security reports belong in the private channel described in
[SECURITY.md](SECURITY.md), not a public issue.

By contributing, you agree that your contribution is licensed under the MIT
License in [LICENSE](LICENSE).

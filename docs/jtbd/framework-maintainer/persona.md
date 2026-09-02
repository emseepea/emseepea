---
name: framework-maintainer
description: A maintainer who extends, verifies, and publishes Em See Pea.
human-oversight: confirmed
oversight-date: 2026-09-02
---

# Framework Maintainer

## Who

A contributor responsible for the framework, examples, documentation, or releases.

## Context Constraints

- The public protocol and package contents must be independently verifiable.
- Examples are templates for adopters, not throwaway demonstrations.
- A release can pass source tests while still containing the wrong files.

## Pain Points

- Protocol additions can make unsupported claims appear complete.
- Package and documentation drift is easy to miss.
- Release automation can hide partial or broken publication.

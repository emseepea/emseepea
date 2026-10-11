// ADR-0120/0121: merge-back qualification starts before dependencies are
// installed, so this exact contract must use only Node.js built-ins. The
// workflow-parsing drift check lives in check-release-pull-request.mjs and its
// tests, where locked dependencies are available.
export const requiredFullQualityJobNames = Object.freeze([
  "Known dependency vulnerabilities",
  "Node.js 22.23.2",
  "Node.js 24.21.0",
  "Standalone initializer / api-backed-server / Node.js 24.21.0",
  "Standalone initializer / database-schema-server / Node.js 24.21.0",
  "Standalone initializer / html-ui-server / Node.js 24.21.0",
  "Standalone initializer / mongodb-backed-server / Node.js 24.21.0",
  "Standalone initializer / multi-instance-postgres-server / Node.js 24.21.0",
  "Standalone initializer / openapi-backed-server / Node.js 24.21.0",
  "Standalone initializer / progress-streaming-server / Node.js 24.21.0",
  "Standalone initializer / react-ui-server / Node.js 24.21.0",
  "Standalone initializer / resources-and-prompts-server / Node.js 24.21.0",
  "Standalone initializer / soap-backed-server / Node.js 24.21.0",
  "Standalone initializer / tool-server / Node.js 24.21.0",
  "Website publication checks",
]);

# Get Started from Source

Em See Pea is pre-alpha. This guide runs the current source checkout for local
development and evaluation. It is not production deployment guidance.

## Install and Check the Source

Use Node.js 22 or 24 and the npm version recorded in `package.json`.

```sh
npm ci --ignore-scripts
npm test
```

The test builds every workspace and checks the public Fastify HTTP boundary.

## Run an Example

Build once, then run one example command at a time:

```sh
npm run build
npm run start:basic
npm run start:backend
npm run start:protected
npm run start:resources-prompts
npm run start:native-ui
npm run start:react-ui
npm run start:streaming
npm run start:multi-instance
```

Each server prints its local Model Context Protocol (MCP) address. Stop it with
Control-C.

Choose the example that matches your task:

- [Basic tool without a user interface](../../examples/basic-no-ui/README.md)
- [Public web service backend](../../examples/backend-no-ui/README.md)
- [Tool that requires sign-in](../../examples/protected-no-ui/README.md)
- [Resources and prompts](../../examples/resources-prompts/README.md)
- [Native HTML form](../../examples/native-ui/README.md)
- [React form with the Em See Pea stylesheet](../../examples/react-tailwind-ui/README.md)
- [Streaming progress](../../examples/streaming-progress/README.md)
- [Two local server processes sharing SQLite](../../examples/multi-instance/README.md)

React and Tailwind are included in this source checkout, but they are not
published packages yet. The multi-instance example has been checked from the
current source in a fresh local copy. It is not a published feature yet.

## Check Whether a Language Model Understands the Results

Prepare Claude Code first. On first use, or when signed out, run the sign-in
command and follow its prompts. Do not paste credentials into project files.
Then run the evaluation:

```sh
npm run claude:prepare
npm run claude:login
npm run test:eval
```

The check asks a language model questions about results obtained through the
official MCP client. It catches answers that return valid data but explain its
meaning incorrectly.

## What the Documentation Check Proves

The documentation test confirms that commands still name real root scripts and
that local links still exist. It does not prove that a command ran successfully.
The clean-copy and black-box test suites provide runtime evidence.

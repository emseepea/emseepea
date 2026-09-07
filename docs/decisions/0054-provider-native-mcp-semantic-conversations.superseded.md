---
status: "proposed"
date: 2026-09-07
human-oversight: confirmed
oversight-date: 2026-09-07
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-07
supersedes: ["ADR-0053"]
---

# Provider-Native MCP Semantic Conversations

## Context and Problem Statement

The semantic harness currently tells a model to choose MCP calls, supplies a
JSON call-plan shape, and asks for a bounded selection. A passing test therefore
shows that the model followed harness coaching. It does not show that an MCP
client discovered and selected the right advertised tool from an ordinary user
message.

Semantic qualification must exercise normal provider-native MCP discovery and
tool use without hidden guidance that makes the selection easier.

## Decision Drivers

- Send the user's message to the conversation model unchanged.
- Observe actual MCP tool calls rather than a model-authored simulation.
- Preserve exact tool-name, argument, order, count, and no-call assertions.
- Keep each trial isolated and expose no unrelated capabilities.
- Preserve genuine multi-turn conversation history.
- Keep interpretation-only resource and prompt cases honest about their scope.
- Add no generator, evaluation framework, or provider SDK dependency.

## Considered Options

1. **Provider-native MCP conversations**: connect the model CLI to exactly one
   loopback MCP server and record its native tool-use events.
2. **Provider-neutral call plans**: keep the coached JSON planner and describe
   it only as a synthetic selection check.
3. **No tool-selection qualification**: test only interpretation of material
   collected by the harness.

## Decision Outcome

Chosen option: **"Provider-native MCP conversations"**, because it tests the
behaviour the framework claims to qualify without teaching the model how to
select or format a call.

For tool-selection cases, the harness passes each user message verbatim to one
isolated provider conversation. It supplies no selection prompt, JSON plan,
answer wrapper, prepared material, or hidden harness context. Optional
application context remains explicit test input and must represent context used
by the application under test, not test guidance.

Each trial configures exactly one loopback MCP server. Only that server's
advertised tools are available. Shell, filesystem, browser, tool search,
unrelated MCP servers, plugins, slash commands, Chrome integration, and ambient
settings are unavailable. The provider executes calls through its native MCP
client and returns the final answer in the same conversation.

The harness records native tool-use names and arguments and uses those events
for deterministic assertions. Follow-up messages remain in the same provider
conversation. Trials remain independent. The existing three-call limit,
timeouts, cancellation, three answer trials, absence of semantic retries,
effect-safe fixtures, redacted evidence, and separate tool-free meaning judge
remain.

Authentication is passed only to the provider process. A protected test
server's ephemeral credential may be present in its MCP transport
configuration, but neither credential may enter prompts, model text, logs, or
retained evidence.

`prepare()` remains an explicitly harness-prepared interpretation check for
resources, prompts, or deliberately combined material. It does not claim native
selection and may use a clearly identified interpretation prompt. Tests must
not combine prepared material with a native tool-selection claim in one turn.

## Consequences

### Good

- Tool-selection tests exercise real MCP discovery, execution, and responses.
- Hidden planner instructions cannot make a weak tool contract appear strong.
- Follow-up no-call assertions use real provider conversation history.
- The public test API remains ordinary JavaScript.

### Neutral

- Native tool event names include a provider server prefix that the harness
  removes before exposing the advertised MCP tool name.
- Interpretation-only prepared cases remain a separate, narrower form of
  evidence.

### Bad

- Tool-selection qualification depends on the configured provider's native MCP
  client behaviour.
- Provider CLI event or MCP configuration changes can break the harness.
- Native MCP conversations can consume more tokens than the synthetic planner.

## Confirmation

- A behavioural test proves the model input equals the user's message exactly.
- No structured-output schema, selection instruction, call-plan shape, answer
  wrapper, or advertised-tool JSON is sent in a native selection turn.
- Exactly one loopback MCP server is configured and only its advertised tools
  appear in the provider's available-tool list.
- Tool assertions are populated only from native provider tool-use events.
- A follow-up message uses the same provider conversation and can correctly
  make no new call.
- Unknown, unrelated, repeated, or more than three calls fail closed.
- Shell, filesystem, browser, tool search, plugins, ambient settings, and
  unrelated MCP servers remain unavailable.
- Credentials do not appear in prompts, provider output, failures, or evidence.
- Prepared interpretation tests are labelled as such and make no native
  selection claim.
- Every maintained tool example passes live semantic qualification on the exact
  publishing commit before release.

## Pros and Cons of the Options

### Provider-Native MCP Conversations

- Good: Measures the real client behaviour adopters care about.
- Good: Removes the coaching that caused false confidence.
- Bad: Couples live qualification to one provider's MCP integration.

### Provider-Neutral Call Plans

- Good: Keeps execution and validation fully controlled by the harness.
- Bad: Measures compliance with an artificial planning prompt.

### No Tool-Selection Qualification

- Good: Is simple and honest about testing interpretation only.
- Bad: Cannot catch unclear tool descriptions or incorrect autonomous choices.

## Reassessment Criteria

Reassess if the provider cannot expose exactly one loopback MCP server, native
events cannot be captured without retaining sensitive content, or a
provider-neutral agent protocol can reproduce native discovery and tool use
without selection guidance.

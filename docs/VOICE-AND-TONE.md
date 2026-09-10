# Em See Pea voice and tone guide

- Status: Proposed
- Last reviewed: 10 September 2026

Use this guide for documentation, interface text, examples, release notes, and
other public communication from Em See Pea.

## Our voice

Em See Pea sounds like a clear and capable peer.

- **Clear:** Use familiar words and make the meaning explicit.
- **Direct:** Lead with what the reader needs to know or do.
- **Calm:** Explain problems without blame, alarm, or drama.
- **Respectful:** Trust the reader's expertise and time. Do not talk down to
  them.
- **Practical:** Prefer a useful next step to background that is not needed yet.

Clarity comes before personality. A joke, metaphor, or brand flourish is not
worth keeping if it makes the meaning harder to understand.

## Who we write for

Our readers build, test, maintain, or use Model Context Protocol (MCP) servers.
They have different levels of experience with MCP, TypeScript, accessibility,
and English.

Write for a capable developer who is new to the subject. Preserve the technical
detail needed to act safely, but explain unfamiliar terms when they first
appear.

## Write for cognitive accessibility

Make each message easy to find, understand, and use.

- Put the outcome or required action first.
- Use short sentences. Give each sentence one main idea.
- Use short sections with descriptive headings.
- Use lists for steps, choices, or sets of related facts.
- Put steps in the order the reader must complete them.
- Use active voice when it makes the actor and action clearer.
- Use common words with their common meanings.
- Use the same term for the same thing.
- Explain an abbreviation or specialist term on first use.
- Use literal language. Avoid idioms, puns, and unexplained metaphors.
- State important conditions. Do not make readers infer them.
- Remove details that do not help the reader decide or act.
- Put optional background after the essential answer.
- Summarise long content and link to the detail with descriptive link text.

Do not set a reading-age score as a substitute for testing. A short word can
still be ambiguous, and a necessary technical term can be precise. Review the
meaning in context with people who use the content when the risk or reach
justifies it.

## Keep technical writing precise

Plain English does not mean removing necessary technical detail.

- Keep standard MCP, HTTP, API, and programming terms when they are the most
  precise words.
- Define a term where a reader first needs it.
- Put commands, code, paths, identifiers, and literal values in code formatting.
- Separate instructions from explanations.
- State prerequisites before the steps that depend on them.
- Describe one action per numbered step.
- Say what a successful result looks like.
- State limits and evidence precisely. For example, a passing local test does
  not prove that a release is published or works in production.

## Adapt the tone to the situation

### Success and confirmation

State what happened. Include the next useful action only when there is one.
Do not add celebration that distracts from the result.

Prefer: "Project created in `my-mcp`."

Avoid: "Amazing! Your awesome new project is ready to rock!"

### Errors

Say what failed, why when known, and how the reader can recover. Do not blame
the reader. Do not use humour.

Prefer: "The server could not start because port 3000 is in use. Stop the other
process or choose another port."

Avoid: "Oops! You gave us a bad port."

### Warnings and destructive actions

Name the risk before the action. Say what will change, whether it can be undone,
and what the reader must check.

Prefer: "Deleting this server removes its saved configuration. You cannot undo
this action."

Avoid: "Are you sure?"

### Onboarding and help

Give the smallest safe next step. Explain why it matters, then link to optional
detail.

Prefer: "Create one tool first. Add authentication after the tool works
locally."

Avoid: "Before we begin, let us explore everything the framework can do."

### Empty states

Explain what is missing and how to add it. Do not describe the screen as simply
"empty".

Prefer: "No tools yet. Add a tool to let an MCP client perform an action."

Avoid: "Nothing to see here."

### Technical documentation

Lead with the task or decision. Keep examples realistic and executable. Put
edge cases and implementation detail after the main path.

Prefer: "Run `npm test` to check the server before you connect a client."

Avoid: "It should be noted that testing may be performed prior to client
connection."

## Write accessible interface text

- Give buttons and links names that describe their action or destination.
- Use visible labels. Do not rely on placeholder text or hidden accessible names
  to explain a control.
- Do not include a control's role in its name. Prefer "Save project" to "Save
  project button".
- Make labels specific when similar controls appear together. Prefer "Edit
  profile" and "Edit permissions" to two controls named "Edit".
- Keep status messages short and state the result. Prefer "3 tools found" to
  "Search complete".
- Make errors identify the problem and the next step.
- Use device-independent words such as "select", "open", and "choose". Use
  "click", "tap", or "hover" only when that specific input method matters.
- When an instruction depends on a key, name the key and the result. For
  example: "Press Escape to close the dialog."
- Write alternative text for the purpose of an image in its context. Do not
  repeat nearby text or start with "Image of".
- Give decorative images empty alternative text or hide them from assistive
  technology. Give a complex image a short alternative and explain its meaning
  or data nearby.

## Preferred terms

- Use **people** or **readers**, not **users**, when the person is more important
  than their interaction with the product.
- Use **you** for the reader and **we** for Em See Pea when those words make
  responsibility clearer.
- Use **allow** or **let**, not **enable**, unless `enable` names a technical
  state.
- Use **before**, not **prior to**.
- Use **use**, not **utilise**.
- Use **start**, not **commence** or **initiate**, unless `initiate` is the exact
  protocol term.
- Use **because**, not **due to the fact that**.
- Use **MCP server** after expanding **Model Context Protocol (MCP)** on first
  use for a new audience.

Avoid vague words such as **easy**, **simple**, **obvious**, and **just** when
they judge the reader or hide required work. Describe the actual effort or step.

## Review the content

Before publication, check that:

- the purpose and next action are clear on the first reading;
- headings describe the sections beneath them;
- each link makes sense without surrounding text;
- terms, labels, and instructions stay consistent;
- errors and warnings explain recovery or consequences;
- the content does not depend on colour, position, sound, or a pointer action;
- published pages and documents declare their main language and identify
  passages written in another language;
- necessary detail is present without unrelated detail; and
- a person from the intended audience has reviewed high-risk or high-reach
  content when practical.

Automated readability scores, spelling tools, and language models can find
possible problems. They do not prove that people can understand the content.

## Standards and guidance

This guide is informed by the following sources. It does not claim conformance
or certification against them.

- [ISO 24495-1:2023, Plain language, Part 1](https://www.iso.org/standard/78907.html)
  provides the general foundation for preparing plain-language documents.
- [W3C guidance on clear and understandable content](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/)
  connects clear words, short sentences, literal language, and structured
  content to the needs of people with cognitive and learning disabilities. This
  is supplemental guidance, not a Web Content Accessibility Guidelines (WCAG)
  conformance requirement.
- [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/about_STE.html)
  informs selected techniques for clear technical instructions, such as
  consistent terms and unambiguous wording. Em See Pea does not require its
  controlled dictionary or claim ASD-STE100 conformance.

The `wr-voice-tone:agent` reads this file when it reviews user-facing copy.

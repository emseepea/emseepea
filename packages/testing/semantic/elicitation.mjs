// Scripted human input through the native client's control channel, never model guidance.
export function redactElicitationEvidence(value, secrets) {
  let json = JSON.stringify(value);
  for (const secret of secrets.filter((item) => typeof item === "string" && item)) {
    // Escape exactly as JSON does, so embedded quotes and backslashes are scrubbed too.
    const escaped = JSON.stringify(secret).slice(1, -1);
    json = json.split(escaped).join("[REDACTED]");
  }
  return JSON.parse(json);
}

export function scriptedElicitations(options = {}, secrets = []) {
  const expected = options.elicitations ?? [];
  if (!Array.isArray(expected) || expected.length > 8) throw new Error("Invalid scripted elicitations");
  for (const entry of expected) {
    if (!entry || !Array.isArray(entry.messageIncludes) || entry.messageIncludes.length === 0
      || entry.messageIncludes.length > 8
      || entry.messageIncludes.some((text) => typeof text !== "string" || !text || text.length > 4096)
      || !entry.response || !["accept", "decline", "cancel"].includes(entry.response.action)
      || JSON.stringify(entry.response).length > 16_384) throw new Error("Invalid scripted elicitation");
  }
  const fixtures = structuredClone(expected);
  const used = new Set();
  const evidence = [];
  return {
    evidence,
    respond(request) {
      if (request?.subtype !== "elicitation" || request.mcp_server_name !== "emseepea_eval"
        || (request.mode !== undefined && request.mode !== "form")
        || typeof request.message !== "string" || request.message.length > 16_384
        || !request.requested_schema || typeof request.requested_schema !== "object"
        || JSON.stringify(request.requested_schema).length > 16_384) {
        throw new Error("Unsupported native elicitation request");
      }
      const item = redactElicitationEvidence({ mode: "form", message: request.message,
        requestedSchema: request.requested_schema }, secrets);
      evidence.push(item);
      const matches = fixtures.map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.messageIncludes.every((text) => request.message.includes(text)));
      if (matches.length !== 1 || used.has(matches[0].index)) throw new Error("Unexpected or duplicate native elicitation");
      const { entry, index } = matches[0];
      used.add(index);
      item.response = redactElicitationEvidence(entry.response, secrets);
      item.inputSource = "scripted-human";
      return entry.response;
    },
    finish() {
      if (used.size !== fixtures.length) throw new Error("Unused scripted elicitation response");
    },
  };
}

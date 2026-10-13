import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { runNativeChatGptJourney } from "../dist/chatgpt.js";

// Real Chromium, intercepted DOM fixture: this is NOT live ChatGPT qualification.
test("native controls drive attachment, iframe card, and fresh retrieval in a Chromium fixture", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "native-dom-fixture-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const html = `<!doctype html><html><body>
    <div id="prompt-textarea" contenteditable="true"></div>
    <input type="file" multiple><span id="attached" hidden>fixture.pdf</span>
    <button data-testid="send-button">Send</button><div id="messages"></div>
    <script>
      document.querySelector('input').onchange = () => document.querySelector('#attached').hidden = false;
      document.querySelector('button').onclick = () => {
        history.pushState({}, '', '/c/' + crypto.randomUUID());
        const reply = document.createElement('div');
        reply.dataset.messageAuthorRole = 'assistant';
        reply.textContent = 'Synthetic saved diagram ready at 08:10';
        document.querySelector('#messages').append(reply);
        const card = document.createElement('iframe');
        card.title = 'Synthetic diagram';
        card.srcdoc = '<html><body><div id="card" style="width:160px;height:100px;background:lightblue">Synthetic diagram</div></body></html>';
        reply.append(card);
      };
    </script></body></html>`;
  await page.route("https://chatgpt.com/**", (route) => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://chatgpt.com/");
  const file = join(directory, "fixture.pdf");
  await writeFile(file, "synthetic attachment");
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const endpoint = new URL("https://synthetic.example/mcp");
  const send = (id) => ({ id, operation: "send", prompt: "Retrieve the synthetic diagram", expectResponse: (text) => text.includes("08:10") });
  const observe = (id) => ({ id, operation: "server-observation", expectedCalls: [{ method: "tools/call", target: "read-diagram", outcome: "success" }],
    collect: async ({ runId, afterSequence, since }) => [{ runId, sequence: afterSequence + 1, observedAt: since,
      endpointSha256: hash(endpoint.href), nativeClient: "verified-chatgpt", method: "tools/call", target: "read-diagram",
      outcome: "success", requestSha256: hash("fixture request"), responseSha256: hash("fixture response") }] });
  const evidence = await runNativeChatGptJourney({
    enabled: true, runId: "chromium-fixture", page, timeoutMs: 5000,
    authorization: { approved: true, accountOwner: "fixture", endpointOwner: "fixture", fixtureOwner: "fixture", cleanupOwner: "fixture", fixturePolicy: "synthetic", endpoint },
    checkpoints: [
      { id: "attach", operation: "attach", file, mimeType: "application/pdf", ready: page.locator("#attached") },
      send("initial"), observe("initial-observation"),
      { id: "card", operation: "visible", target: page.frameLocator('iframe').locator("#card") },
      { id: "card-image", operation: "image", target: page.frameLocator('iframe').locator("#card"), assertImage: async (png) => png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
      { id: "fresh", operation: "fresh-conversation" }, send("retrieve"), observe("retrieve-observation"),
    ],
    cleanup: async () => { await page.goto("https://chatgpt.com/"); return { fixturesRemoved: true, conversationsRemoved: true }; },
  }, join(directory, "fixture-only-evidence.json"));
  assert.equal(evidence.status, "passed", JSON.stringify(evidence.checkpoints));
  const turns = evidence.checkpoints.filter((checkpoint) => checkpoint.operation === "send");
  assert.notEqual(turns[0].observation.conversationSha256, turns[1].observation.conversationSha256);
});

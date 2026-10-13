// The owner exposes this local browser interface; this module never launches,
// authenticates, exports storage, or bypasses a browser challenge.
export function validateBrowserAttachment(endpoint, browserOwner, accountOwner) {
  if (typeof accountOwner !== "string" || !accountOwner.trim() || browserOwner !== accountOwner) throw new Error("browser-owner-confirmation-required");
  if (typeof endpoint !== "string" || endpoint.length > 256 || !/^ws:\/\/127\.0\.0\.1:[0-9]+\/devtools\/browser(?:\/[A-Za-z0-9-]+)?$/.test(endpoint)) throw new Error("loopback-browser-endpoint-required");
  let url;
  try { url = new URL(endpoint); }
  catch { throw new Error("loopback-browser-endpoint-required"); }
  if (Number(url.port) < 1024 || Number(url.port) > 65535 || !url.port || url.pathname.length > 150) throw new Error("loopback-browser-endpoint-required");
  return url.href;
}

export async function attachOwnedBrowser({ chromium, endpoint, browserOwner, accountOwner }) {
  const address = validateBrowserAttachment(endpoint, browserOwner, accountOwner);
  const transport = browserTransport(address);
  let browser;
  let page;
  try {
    // Supported Playwright transport seam: Node's WebSocket rejects redirects,
    // while Playwright's URL connector follows them. Keep browser defaults.
    transport.open();
    browser = await chromium.connectOverCDP(transport, { timeout: 30_000, noDefaults: true });
    const contexts = browser.contexts();
    if (contexts.length !== 1) throw new Error("owned-browser-context-required");
    // A new tab shares the owner's authorized session without selecting,
    // navigating, closing, or retaining any pre-existing private tab.
    page = await contexts[0].newPage();
    await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    return { page, async close() {
      try { await page.close({ runBeforeUnload: false }); }
      finally { await browser.close(); } // CDP-connected close disconnects, not browser termination.
    } };
  } catch {
    try { await page?.close({ runBeforeUnload: false }); } catch { /* redacted */ }
    try { await browser?.close(); } catch { /* redacted */ }
    transport.close();
    throw new Error("owned-browser-attachment-unavailable");
  }
}

// Only JSON framing for Playwright's public ConnectOverCDPTransport interface.
// Playwright owns all CDP/browser semantics. No messages are retained or logged.
function browserTransport(address) {
  let socket;
  let ended = false;
  const pending = [];
  let pendingBytes = 0;
  const finish = () => {
    if (ended) return;
    ended = true;
    pending.length = 0;
    pendingBytes = 0;
    transport.onclose?.("browser-connection-closed");
  };
  const transport = {
    open() {
      socket = new WebSocket(address);
      socket.onopen = () => {
        try { for (const message of pending) socket.send(message); pending.length = 0; pendingBytes = 0; }
        catch { transport.close(); finish(); }
      };
      socket.onmessage = (event) => {
        try {
          if (typeof event.data !== "string" || Buffer.byteLength(event.data) > 16 * 1024 * 1024) throw new Error("bounded-message-required");
          transport.onmessage?.(JSON.parse(event.data));
        } catch { transport.close(); finish(); }
      };
      socket.onerror = finish;
      socket.onclose = finish;
    },
    send(message) {
      const encoded = JSON.stringify(message);
      if (ended || Buffer.byteLength(encoded) > 16 * 1024 * 1024) throw new Error("bounded-message-required");
      if (socket.readyState === WebSocket.CONNECTING) {
        if (pending.length >= 64 || pendingBytes + Buffer.byteLength(encoded) > 16 * 1024 * 1024) throw new Error("bounded-message-required");
        pending.push(encoded);
        pendingBytes += Buffer.byteLength(encoded);
      } else socket.send(encoded);
    },
    close() { socket?.close(); },
  };
  return transport;
}

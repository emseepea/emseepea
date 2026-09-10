export async function requestJson(
  fetcher: typeof fetch,
  url: URL,
  init: RequestInit,
  expected: readonly number[],
): Promise<{ readonly status: number; readonly value: unknown }> {
  const response = await fetcher(url, init);
  if (!expected.includes(response.status)) {
    throw new Error(`Feedback provider request failed with HTTP ${response.status}`);
  }
  if (response.status === 204) return { status: response.status, value: undefined };
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new Error("Feedback provider returned a non-JSON response");
  }
  return { status: response.status, value: JSON.parse(await boundedText(response, 2 * 1024 * 1024)) };
}

async function boundedText(response: Response, maximumBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new Error("Feedback provider response exceeded the byte limit");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) throw new Error("Feedback provider response exceeded the byte limit");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const contents = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    contents.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(contents);
}

export function bearerHeaders(token: string): Readonly<Record<string, string>> {
  if (token.length === 0) throw new Error("Feedback provider token is required");
  return Object.freeze({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
}

export function providerRequestInit(
  context: FeedbackAdapterContext,
  init: RequestInit,
): RequestInit {
  return { ...init, signal: deadlineSignal(context) };
}
import { deadlineSignal } from "./deadline.js";
import type { FeedbackAdapterContext } from "./index.js";

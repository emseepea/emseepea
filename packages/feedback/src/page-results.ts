export function feedbackPageText(kind: "threads" | "messages", count: number, hasMore: boolean): string {
  const summary = count === 0 ? `No feedback ${kind} on this page.` : `Feedback ${kind} are in the structured result.`;
  return hasMore ? `${summary} Use the returned cursor to read the next page.` : summary;
}

export function feedbackResultFits(data: unknown, text: string, maxBytes: number): boolean {
  return Buffer.byteLength(JSON.stringify({
    content: [{ type: "text", text }],
    structuredContent: data,
    isError: false,
  })) <= maxBytes;
}

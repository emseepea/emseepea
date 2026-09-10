import type { FeedbackAdapterContext } from "./index.js";

export function deadlineSignal(
  context: Pick<FeedbackAdapterContext, "signal" | "deadlineMs">,
): AbortSignal {
  context.signal.throwIfAborted();
  const remaining = context.deadlineMs - Date.now();
  if (remaining <= 0) throw new DOMException("The feedback deadline expired", "TimeoutError");
  return AbortSignal.any([context.signal, AbortSignal.timeout(remaining)]);
}

export async function beforeDeadline<T>(
  promise: Promise<T>,
  context: Pick<FeedbackAdapterContext, "signal" | "deadlineMs">,
): Promise<T> {
  const signal = deadlineSignal(context);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

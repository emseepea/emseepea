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
  context.signal.throwIfAborted();
  const remaining = context.deadlineMs - Date.now();
  if (remaining <= 0) throw new DOMException("The feedback deadline expired", "TimeoutError");
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      context.signal.removeEventListener("abort", abort);
    };
    const succeed = (value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(context.signal.reason);
    context.signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(
      () => fail(new DOMException("The feedback deadline expired", "TimeoutError")),
      remaining,
    );
    promise.then(succeed, fail);
  });
}

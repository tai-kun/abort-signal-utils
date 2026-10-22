import getAbortReason from "./get-abort-reason.js";
import throwIfAborted from "./throw-if-aborted.js";

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/with-signal)
 */
export default async function withSignal<T>(
  signal: AbortSignal,
  task: () => T,
): Promise<Awaited<T>> {
  throwIfAborted(signal);

  let dispose = (): void => {};

  const wait = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(getAbortReason(signal));
      return;
    }

    const handleAbort = (): void => {
      reject(getAbortReason(signal));
    };

    signal.addEventListener("abort", handleAbort, { once: true });

    dispose = (): void => {
      signal.removeEventListener("abort", handleAbort);
    };
  });

  try {
    return await Promise.race([wait, task()]);
  } finally {
    dispose();
  }
}

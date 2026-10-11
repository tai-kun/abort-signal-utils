import throwIfAborted from "./throw-if-aborted.js";
import toAbortPromise from "./to-abort-promise.js";

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/with-signal)
 */
export default async function withSignal<T>(
  signal: AbortSignal,
  task: () => T,
): Promise<Awaited<T>> {
  throwIfAborted(signal);

  const wait = toAbortPromise(signal);

  try {
    return await Promise.race([task(), wait]);
  } finally {
    wait.dispose();
  }
}

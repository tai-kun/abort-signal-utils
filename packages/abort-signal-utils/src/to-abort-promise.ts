import { NinjaPromise } from "ninja-promise";

import getAbortReason from "./get-abort-reason.js";

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/to-abort-promise)
 */
export type ToAbortPromiseOptions = {
  /**
   * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/to-abort-promise#unsubscribe)
   */
  readonly cleanupSignal?: AbortSignal | undefined;
};

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/to-abort-promise)
 */
export interface AbortPromiseLike extends PromiseLike<never>, Disposable {
  /**
   * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/to-abort-promise#unsubscribe)
   */
  dispose(): void;
}

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/to-abort-promise)
 */
export default function toAbortPromise(
  signal: unknown,
  options: ToAbortPromiseOptions = {},
): AbortPromiseLike {
  let dispose = () => {};

  const promise = new NinjaPromise<never>((_, reject) => {
    if (!(signal instanceof AbortSignal)) {
      return;
    }

    if (signal.aborted) {
      reject(getAbortReason(signal));

      return;
    }

    const { cleanupSignal } = options;
    if (cleanupSignal?.aborted) {
      return;
    }

    const handleAbort = (): void => {
      signal.removeEventListener("abort", handleAbort);
      cleanupSignal?.removeEventListener("abort", handleCleanup);
      reject(getAbortReason(signal));
    };

    const handleCleanup = (): void => {
      signal.removeEventListener("abort", handleAbort);
      cleanupSignal?.removeEventListener("abort", handleCleanup);
    };

    dispose = (): void => {
      signal.removeEventListener("abort", handleAbort);
      cleanupSignal?.removeEventListener("abort", handleCleanup);
    };

    signal.addEventListener("abort", handleAbort, { once: true });

    if (cleanupSignal !== undefined) {
      cleanupSignal.addEventListener("abort", handleCleanup, { once: true });
    }
  });

  const abortPromise = promise as unknown as AbortPromiseLike;

  abortPromise.dispose = dispose;

  if (typeof Symbol.dispose === "symbol") {
    abortPromise[Symbol.dispose] = dispose;
  }

  return abortPromise;
}

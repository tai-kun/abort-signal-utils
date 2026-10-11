import { NinjaPromise } from "ninja-promise";

import getAbortReason from "./get-abort-reason.js";

/**
 * toAbortPromise の選択肢です。
 */
export type ToAbortPromiseOptions = {
  /**
   * 待ちの購読を止める合図です。
   *
   * 中断されると待ちを止めて未確定のまま残します。
   * 中断済みなら最初から購読しません。
   */
  readonly cleanupSignal?: AbortSignal | undefined;
};

/**
 * 中断待ちの PromiseLike です。
 *
 * 中断されると中断理由で拒否されます。
 * 待ちが不要になったら dispose で購読を解除できます。
 * 解除後は中断しても拒否されず未確定のまま残ります。
 */
export interface AbortPromiseLike extends PromiseLike<never>, Disposable {
  /**
   * 待ちの購読を解除します。
   *
   * 呼び出し後は中断しても拒否されません。
   * 何度呼んでも安全です。
   */
  dispose(): void;
}

/**
 * AbortSignal の中断を待ち受ける PromiseLike を作ります。
 *
 * 中断されると中断理由で拒否されます。
 * すでに中断済みなら即座に拒否されます。
 * AbortSignal 以外の値では未確定のまま残る PromiseLike を返します。
 * 待ちが不要になったら dispose で購読を解除できます。
 * cleanupSignal が中断されると待ちを止めて未確定のまま残します。
 *
 * @param signal 待ち受ける値です。AbortSignal 以外は無視します。
 * @param options 待ちの後始末の選択肢です。cleanupSignal 以外は無視します。
 * @returns 中断で拒否される PromiseLike です。dispose で購読を解除できます。
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

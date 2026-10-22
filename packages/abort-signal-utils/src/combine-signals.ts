import asAbortSignal from "./internal/abort-signal.js";

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/combine-signals)
 */
export type CombineSignalsOptions = {
  /**
   * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/combine-signals)
   */
  readonly cleanupSignal?: AbortSignal | undefined;
};

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/combine-signals#combine-signals)
 */
export default function combineSignals(
  signals: readonly unknown[],
  options: CombineSignalsOptions = {},
): AbortSignal {
  let firstAborted: AbortSignal | undefined;
  const validSignals: AbortSignal[] = [];
  for (const signal of signals) {
    if (signal instanceof AbortSignal) {
      if (signal.aborted) {
        // 先頭優先のため最初の1回だけ記録します。
        if (firstAborted === undefined) {
          firstAborted = signal;
        }
      } else {
        validSignals.push(signal);
      }
    }
  }

  if (firstAborted !== undefined) {
    // 中断済み入力がある場合は cleanupSignal に触らずその理由で中断します。
    const controller = new AbortController();
    controller.abort(firstAborted.reason);
    return controller.signal;
  }

  if (validSignals.length === 0) {
    // 有効な入力がない場合は cleanupSignal に触らず新規の未中断を返します。
    return new AbortController().signal;
  }

  const cleanupSignal = asAbortSignal(options.cleanupSignal);
  if (cleanupSignal !== undefined && !cleanupSignal.aborted) {
    if (typeof AbortSignal.any === "function") {
      // ネイティブがあるのに cleanupSignal で代替実装に切り替わることを知らせます。
      console.log(
        "combineSignals: AbortSignal.any is available, but cleanupSignal was specified, so falling back to the manual implementation.",
      );
    }

    // 未中断の cleanupSignal がある場合はネイティブを迂回して代替実装で束ねます。
    return combineManually(validSignals, cleanupSignal);
  }

  if (typeof AbortSignal.any === "function") {
    const combined = AbortSignal.any(validSignals);

    // Node.js の AbortSignal.any は abort リスナーがないと reason を遅延評価し、複数の入力が中断した場合に最初の中断理由を保持しないことがあります。
    // 振る舞いを安定させるため、中断時に何もしないリスナーを 1 つ登録します。
    combined.addEventListener("abort", noop, { once: true });

    return combined;
  }

  // ネイティブがない場合は cleanupSignal なしの代替実装で結合します。
  return combineManually(validSignals, undefined);
}

function noop(): void {}

/**
 * 入力と cleanupSignal を手作業で束ねます。
 *
 * cleanupSignal ありとなしの両方で使います。
 */
function combineManually(
  validSignals: readonly AbortSignal[],
  cleanupSignal: AbortSignal | undefined,
): AbortSignal {
  const controller = new AbortController();
  let decided = false;

  function unsubscribe(): void {
    // 以後の発火を止めるため、入力と cleanupSignal の購読をまとめて解除します。
    for (const signal of validSignals) {
      signal.removeEventListener("abort", handleAbort);
    }

    cleanupSignal?.removeEventListener("abort", handleCleanup);
  }

  function handleAbort(this: AbortSignal): void {
    if (decided) {
      return;
    }

    decided = true;

    // cleanupSignal の中断が先に進行している場合は、入力の中断に追従しません。
    if (cleanupSignal !== undefined && cleanupSignal !== this && cleanupSignal.aborted) {
      unsubscribe();
      return;
    }

    // 入力の中断を結果に伝えます。
    controller.abort(this.reason);
    unsubscribe();
  }

  function handleCleanup(): void {
    if (decided) {
      // 入力側ですでに結果が確定している場合は、購読の解除だけを行います。
      unsubscribe();
      return;
    }

    decided = true;

    // cleanupSignal の中断中に入力が先に中断していた場合は、その理由を結果に伝えます。
    for (const signal of validSignals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }
    }

    // 入力が中断していなければ結果に触れず、購読だけを解除します。
    unsubscribe();
  }

  for (const signal of validSignals) {
    // 入力を先に登録して同一オブジェクトでも入力側を先に走らせます。
    signal.addEventListener("abort", handleAbort, { once: true });
  }

  if (cleanupSignal !== undefined) {
    // cleanupSignal は入力の後に登録して後から走らせます。
    cleanupSignal.addEventListener("abort", handleCleanup, { once: true });
  }

  // 重複入力は重ねて登録しても発火は 1 回になります。
  // abort は冪等なので重ねて呼んでも安全です。
  // removeEventListener は冪等なので重ねて外しても安全です。
  return controller.signal;
}

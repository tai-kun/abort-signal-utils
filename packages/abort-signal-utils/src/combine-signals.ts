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

  const { cleanupSignal } = options;
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
    // 全要素が AbortSignal の典型例では配列を作り直さずに渡します。
    let allValid = true;
    for (let i = 0; i < signals.length; i++) {
      if (!(signals[i] instanceof AbortSignal)) {
        allValid = false;
        break;
      }
    }

    if (allValid) {
      // AbortSignal.any は入力配列を変更しないため、このキャストは安全です。
      return AbortSignal.any(signals as unknown as AbortSignal[]);
    }

    const filteredSignals = signals.filter(
      (signal): signal is AbortSignal => signal instanceof AbortSignal,
    );

    return AbortSignal.any(filteredSignals);
  }

  // ネイティブがない場合は cleanupSignal なしの代替実装で結合します。
  return combineManually(validSignals, undefined);
}

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

  function handleAbort(this: AbortSignal): void {
    // 入力の中断を結果に伝えます。
    controller.abort(this.reason);
    // 以後の発火を止めるため全ての購読を解除します。
    for (const signal of validSignals) {
      signal.removeEventListener("abort", handleAbort);
    }

    // cleanupSignal の購読も解除します。
    cleanupSignal?.removeEventListener("abort", handleCleanup);
  }

  function handleCleanup(): void {
    // cleanupSignal では結果に触りません。
    // 以後の発火を止めるため入力の購読を解除します。
    for (const signal of validSignals) {
      signal.removeEventListener("abort", handleAbort);
    }

    // cleanupSignal 自身の購読も解除します。
    cleanupSignal?.removeEventListener("abort", handleCleanup);
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

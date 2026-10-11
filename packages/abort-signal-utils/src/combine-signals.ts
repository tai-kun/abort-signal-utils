/**
 * 複数の AbortSignal を 1 つにまとめます。
 *
 * AbortSignal 以外の値は無視します。有効なシグナルが 1 つもなくても、未中断の新しいシグナルを返します。
 * AbortSignal.any がある環境ではそれに委譲します。ない環境では同等の代替実装で結合します。
 *
 * @param signals 結合する値の配列です。AbortSignal 以外は無視します。
 * @returns 結合した新しい AbortSignal です。
 */
export default function combineSignals(signals: readonly unknown[]): AbortSignal {
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

    const validSignals = signals.filter(
      (signal): signal is AbortSignal => signal instanceof AbortSignal,
    );

    return AbortSignal.any(validSignals);
  }

  // AbortSignal.any のない環境向けの代替実装です。
  const controller = new AbortController();
  const validSignals: AbortSignal[] = [];
  for (const signal of signals) {
    if (signal instanceof AbortSignal) {
      if (signal.aborted) {
        // 中断済みが 1 つでもあれば、その理由で即座に中断します。
        controller.abort(signal.reason);
        return controller.signal;
      }

      validSignals.push(signal);
    }
  }

  function handleAbort(this: AbortSignal): void {
    controller.abort(this.reason);

    for (const signal of validSignals) {
      signal.removeEventListener("abort", handleAbort);
    }
  }

  for (const signal of validSignals) {
    signal.addEventListener("abort", handleAbort, { once: true });
  }

  return controller.signal;
}

/**
 * 複数の AbortSignal を 1 つに結合します。
 *
 * @param signals 結合対象となる AbortSignal の配列です。
 * @returns 結合された新しい AbortSignal です。
 */
export default function combineSignals(signals: readonly unknown[]): AbortSignal {
  const inputSignals = signals;

  if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
    // AbortSignal.any がネイティブでサポートされている場合はそれを使用します。

    // すべての要素が AbortSignal である場合が一般的として、フィルターによる配列の再生成を避けてそのまま渡します。
    let isInvalid = false;
    for (let i = 0; i < inputSignals.length; i++) {
      if (!(inputSignals[i] instanceof AbortSignal)) {
        isInvalid = true;
        break;
      }
    }

    if (isInvalid) {
      const signals = inputSignals.filter((signal) => signal instanceof AbortSignal);
      return AbortSignal.any(signals);
    }

    // AbortSignal.any は渡された配列を変更しないため、このキャストは安全です。
    return AbortSignal.any(inputSignals as unknown as AbortSignal[]);
  } else {
    // AbortSignal.any が未実装の環境向けのポリフィル実装です。

    const ac = new AbortController();
    const signals: AbortSignal[] = [];
    for (const signal of inputSignals) {
      if (signal instanceof AbortSignal) {
        if (signal.aborted) {
          // すでに中断されている場合は、その理由を使用して即座に中断処理を行います。
          ac.abort(signal.reason);
          return ac.signal;
        }

        signals.push(signal);
      }
    }

    function handleAbort(this: AbortSignal): void {
      ac.abort(this.reason);

      for (const signal of signals) {
        signal.removeEventListener("abort", handleAbort);
      }
    }

    for (const signal of signals) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    return ac.signal;
  }
}

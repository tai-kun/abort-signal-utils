import combineSignals from "./combine-signals.js";
import type { CombineSignalsOptions } from "./combine-signals.js";

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/combine-signals#combine-signals-fast)
 */
export default function combineSignalsFast(
  signals: readonly unknown[],
  options: CombineSignalsOptions = {},
): AbortSignal {
  let single: AbortSignal | undefined;

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (signal instanceof AbortSignal) {
      if (single !== undefined) {
        // 2 つ目が見つかった時点で高速化できないため、以後の判定は combineSignals に委譲します。
        return combineSignals(signals, options);
      }

      single = signal;
    }
  }

  if (single === undefined) {
    // 有効な入力がない場合は cleanupSignal に触らず新規の未中断を返します。
    return new AbortController().signal;
  }

  if (single.aborted) {
    // 中断済みの単一入力は cleanupSignal に触らずそのまま返します。
    return single;
  }

  const { cleanupSignal } = options;
  if (cleanupSignal !== undefined && !cleanupSignal.aborted) {
    // 未中断の cleanupSignal がある場合は解除可能にするため新規オブジェクトで結合します。
    return combineSignals(signals, options);
  }

  // 未中断の cleanupSignal がない場合は単一入力をそのまま返します。
  return single;
}

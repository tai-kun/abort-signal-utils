import combineSignals from "./combine-signals.js";
import type { CombineSignalsOptions } from "./combine-signals.js";

/**
 * 有効なシグナルが 1 つだけならそれ自体を返す combineSignals の亜種です。
 *
 * 有効な AbortSignal が 1 つだけなら、新しいシグナルを作らずにそれ自体を返します。有効なシグナルがなければ未中断の新しいシグナルを返します。2 つ以上あれば combineSignals に委譲します。
 * 単一または空の経路では cleanupSignal に触れません。
 * 単一の未中断と未中断の cleanupSignal がある場合は新規オブジェクトで結合します。
 *
 * @param signals 結合する値の配列です。AbortSignal 以外は無視します。
 * @param options 結合の選択肢です。cleanupSignal 以外は無視します。
 * @returns 結合した AbortSignal です。入力と同じオブジェクトの場合があります。
 *
 * 返されたシグナルへの変更は元のシグナルにも波及します。独立したオブジェクトが必要なら combineSignals を使ってください。
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

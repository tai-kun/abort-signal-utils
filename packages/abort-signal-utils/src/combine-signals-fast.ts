import combineSignals from "./combine-signals.js";

/**
 * 有効なシグナルが 1 つだけならそれ自体を返す combineSignals の亜種です。
 *
 * 有効な AbortSignal が 1 つだけなら、新しいシグナルを作らずにそれ自体を返します。有効なシグナルがなければ未中断の新しいシグナルを返します。2 つ以上あれば combineSignals に委譲します。
 *
 * @param signals 結合する値の配列です。AbortSignal 以外は無視します。
 * @returns 結合した AbortSignal です。入力と同じオブジェクトの場合があります。
 *
 * 返されたシグナルへの変更は元のシグナルにも波及します。独立したオブジェクトが必要なら combineSignals を使ってください。
 */
export default function combineSignalsFast(signals: readonly unknown[]): AbortSignal {
  let single: AbortSignal | undefined;

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (signal instanceof AbortSignal) {
      if (single !== undefined) {
        // 2 つ目が見つかった時点で高速化できないため、以後の判定は combineSignals に委譲します。
        return combineSignals(signals);
      }

      single = signal;
    }
  }

  // 有効なシグナルがなければ、未中断の新しいシグナルを返します。
  return single || new AbortController().signal;
}

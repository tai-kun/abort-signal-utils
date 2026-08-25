import combineSignals from "./combine-signals.js";

/**
 * 複数の AbortSignal を 1 つに結合します。
 *
 * パフォーマンスを重視した combineSignals の亜種です。
 * 有効な AbortSignal が 1 つだけの場合は新しい AbortSignal を生成せず、そのシグナル自体を返します。
 *
 * - 有効な AbortSignal が 1 つだけの場合: そのシグナル自体を返します。中止済みである場合も同様です。
 * - 有効な AbortSignal が 0 個の場合: 未中止の新しい AbortSignal を返します。
 * - 有効な AbortSignal が 2 つ以上の場合: combineSignals と同じ振る舞いになります。
 *
 * 注意: 返されるシグナルは入力の AbortSignal と同一オブジェクトである場合があります。
 * 返されたシグナルに対するリスナーの追加や解除は、元のシグナルを共有しているほかの処理からも観測されます。
 * また、返されたシグナルは入力の AbortController による中止の影響を直接受けます。
 * 結合結果として独立したオブジェクトが必要な場合は、常に新しい AbortSignal を返す combineSignals を使用してください。
 *
 * @param signals 結合対象となる AbortSignal の配列です。
 * @returns 結合された AbortSignal です。入力のシグナルがそのまま返される場合があります。
 */
export default function combineSignalsFast(signals: readonly unknown[]): AbortSignal {
  let found: AbortSignal | undefined;

  const { length } = signals;
  for (let i = 0; i < length; i++) {
    const signal = signals[i];
    if (signal instanceof AbortSignal) {
      if (found !== undefined) {
        // 有効なシグナルが 2 つ以上見つかった時点で、この関数の最適化は適用できません。
        // 以降の判定は combineSignals に委譲します。
        return combineSignals(signals);
      }

      found = signal;
    }
  }

  // 有効なシグナルがない場合は、combineSignals と同じく未中止の新しいシグナルを返します。
  return found ?? new AbortController().signal;
}

import { bench, describe } from "vitest";

/**
 * 指定した数の未中止シグナルを持つ AbortController を生成します。
 */
function makeControllers(size: number): AbortController[] {
  const controllers: AbortController[] = [];
  for (let i = 0; i < size; i++) {
    controllers.push(new AbortController());
  }
  return controllers;
}

// combineSignals の入力バリデーション(filter)部分の単体コストを測定する。
// リスナー蓄積を避けるため、ここでは combineSignals 自体は呼ばない。
describe("入力バリデーションのコスト(combineSignals の一部)", () => {
  for (const size of [1, 10, 100, 1000]) {
    const signals = makeControllers(size).map((ac) => ac.signal);

    bench(`[旧実装] filter で新規配列生成(${size} 個)`, () => {
      const filtered = signals.filter((signal) => signal instanceof AbortSignal);
      void filtered;
    });

    bench(`[新実装] 検証ループのみ・全要素有効(${size} 個)`, () => {
      let invalid = false;
      for (let i = 0; i < signals.length; i++) {
        if (!(signals[i] instanceof AbortSignal)) {
          invalid = true;
          break;
        }
      }
      void invalid;
    });
  }
});

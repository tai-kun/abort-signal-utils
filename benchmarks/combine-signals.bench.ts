import { bench, describe } from "vitest";

import combineSignals from "../src/combine-signals.js";

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

const abortedController = new AbortController();
abortedController.abort(new Error("Already Aborted"));

// 注: 結合によりソースシグナルにはリスナーが登録され、abort されるまで保持される（ネイティブ AbortSignal.any も同様。実測で確認）。
// そのため「結合 → abort → リスナー解除」を 1 サイクルとして測定する。
describe("combineSignals / スケーリング(結合+abort+cleanup)", () => {
  for (const size of [1, 10, 100, 1000]) {
    const controllers = makeControllers(size);
    const signals = controllers.map((ac) => ac.signal);

    bench(`未中止 ${size} 個`, () => {
      combineSignals(signals);
      controllers[0]!.abort("Done");
    });
  }

  bench("空配列", () => {
    combineSignals([]);
  });
});

describe("combineSignals / AbortSignal 以外が混ざるケース", () => {
  const controllers = [new AbortController(), new AbortController()];
  const mixed = [
    controllers[0]!.signal,
    undefined,
    123,
    controllers[1]!.signal,
  ] as unknown as readonly AbortSignal[];

  bench("4 件中 2 件が無効な値(結合+abort+cleanup)", () => {
    combineSignals(mixed);
    controllers[0]!.abort("Done");
  });
});

describe("combineSignals / 特殊ケース(リスナー登録なし)", () => {
  bench("中止済みシグナルを含む(即座に中断される)", () => {
    const live = new AbortController();
    combineSignals([live.signal, abortedController.signal]);
  });

  bench("空配列(再掲: リスナー登録なしの純粋な呼び出しコスト)", () => {
    combineSignals([]);
  });
});

describe("combineSignals / 新規シグナル生成を含むケース", () => {
  bench("controller 生成 + 結合のみ", () => {
    const ac = new AbortController();
    combineSignals([ac.signal]);
  });

  bench("[比較用] controller 生成のみ", () => {
    void new AbortController().signal;
  });
});

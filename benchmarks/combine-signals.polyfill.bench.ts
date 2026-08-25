import { afterAll, beforeAll, bench, describe } from "vitest";

import combineSignals from "../src/combine-signals.js";

// ネイティブ AbortSignal.any を削除し、ポリフィル実装を測定対象にする。
const originalAny = AbortSignal.any?.bind(AbortSignal);

beforeAll(() => {
  // @ts-expect-error テスト(ベンチマーク)のために一時的に削除する。
  delete AbortSignal.any;
});

afterAll(() => {
  AbortSignal.any = originalAny;
});

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

// 注: ポリフィル実装はソースシグナルにリスナーを登録するため、abort してリスナー解除(cleanup)までを 1 サイクルとして測定する。
// さもないと反復回数分のリスナーが蓄積し、測定が不安定かつメモリを圧迫する。
describe("combineSignals(ポリフィル) / スケーリング", () => {
  for (const size of [1, 10, 100, 1000]) {
    const controllers = makeControllers(size);
    const signals = controllers.map((ac) => ac.signal);

    bench(`未中止 ${size} 個(結合+abort+cleanup)`, () => {
      combineSignals(signals);
      controllers[0]!.abort("Done");
    });
  }
});

describe("combineSignals(ポリフィル) / 特殊ケース", () => {
  bench("中止済みシグナルを含む(即座に中断される)", () => {
    const live = new AbortController();
    combineSignals([live.signal, abortedController.signal]);
  });

  bench("AbortSignal 以外が混ざる(4 件中 2 件が無効)", () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    combineSignals([ac1.signal, undefined, 123, ac2.signal] as unknown as readonly AbortSignal[]);
    ac1.abort("Done");
  });
});

describe("[比較用] ポリフィル構成要素の単体コスト", () => {
  bench("AbortController.abort 実行(リスナーなし)", () => {
    const ac = new AbortController();
    ac.abort("Done");
  });

  bench("addEventListener + removeEventListener 1 回", () => {
    const signal = new AbortController().signal;
    const listener = (): void => {};
    signal.addEventListener("abort", listener, { once: true });
    signal.removeEventListener("abort", listener);
  });
});

import { describe, test, beforeEach, afterEach } from "vitest";

import combineSignals from "../src/combine-signals.js";

// テスト実行前のオリジナルのメソッドを保持する。
// oxlint-disable-next-line typescript/unbound-method
const originalAny = AbortSignal.any?.bind(AbortSignal);

describe.skipIf(typeof originalAny !== "function")("ネイティブサポート環境", () => {
  defineCommonTests();
});

describe("非サポート環境", () => {
  beforeEach(() => {
    // ネイティブメソッドを未定義にする。
    // @ts-expect-error テストのためにプロパティを一時的に削除する。
    delete AbortSignal.any;
  });

  afterEach(() => {
    // 元の状態に戻す。
    AbortSignal.any = originalAny;
  });

  defineCommonTests();
});

function defineCommonTests(): void {
  test("未中断の複数のシグナルを渡したとき、返り値のシグナルが未中断になる", ({ expect }) => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();

    const result = combineSignals([ac1.signal, ac2.signal]);

    expect(result.aborted).toBe(false);
  });

  test("結合後にいずれかのシグナルが中断されたとき、返り値のシグナルが同じ理由で中断される", ({
    expect,
  }) => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();

    const result = combineSignals([ac1.signal, ac2.signal]);

    ac2.abort("User Cancel");

    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("User Cancel");
  });

  test("既に中断されているシグナルが含まれるとき、返り値のシグナルが即座に同じ理由で中断される", ({
    expect,
  }) => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    ac2.abort("Timeout");

    const result = combineSignals([ac1.signal, ac2.signal]);

    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("Timeout");
  });

  test("空配列を指定したとき、未中断の AbortSignal が返される", ({ expect }) => {
    const result = combineSignals([]);

    expect(result.aborted).toBe(false);
  });

  test("AbortSignal 以外の値が混入しているとき、それらに対する操作をスキップしてエラーが発生しない", ({
    expect,
  }) => {
    const ac = new AbortController();
    const invalidValues = [undefined, 123];

    expect(() => {
      combineSignals([ac.signal, ...invalidValues]);
    }).not.toThrow();
  });

  test("複数の既に中断されたシグナルが含まれるとき、配列順で最初のシグナルの理由が適用される", ({
    expect,
  }) => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    ac1.abort("Err1");
    ac2.abort("Err2");

    const result = combineSignals([ac1.signal, ac2.signal]);

    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("Err1");
  });
}

import { describe, test as vitest } from "vitest";

import combineSignals from "../src/combine-signals.js";

// テスト実行前のオリジナルのメソッドを保持する。
// oxlint-disable-next-line typescript/unbound-method
const originalAny = AbortSignal.any?.bind(AbortSignal);

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{ noNativeAny?: boolean }>({
  /**
   * ネイティブの AbortSignal.any を削除した環境を提供するフィクスチャーです。
   * ポリフィル実装の動作検証のために使用します。テスト終了後には元のメソッドを復元します。
   */
  // oxlint-disable-next-line no-empty-pattern
  async noNativeAny({}, use) {
    // @ts-expect-error テストのためにプロパティを一時的に削除する。
    delete AbortSignal.any;
    await use(undefined);
    AbortSignal.any = originalAny;
  },
});

describe.skipIf(typeof originalAny !== "function")("ネイティブサポート環境", () => {
  defineCommonTests();
});

describe("ネイティブ非サポート環境", () => {
  test.override({ noNativeAny: true });

  defineCommonTests();
});

function defineCommonTests(): void {
  test("未中断の複数のシグナルを渡したとき、返されるシグナルも未中断である", ({ expect }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();

    // 実行
    const result = combineSignals([ac1.signal, ac2.signal]);

    // 検証
    expect(result.aborted).toBe(false);
  });

  test("結合後にいずれかのシグナルが中断されたとき、返されるシグナルが同じ理由で中断される", ({
    expect,
  }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const result = combineSignals([ac1.signal, ac2.signal]);

    // 実行
    ac2.abort("User Cancel");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("User Cancel");
  });

  test("既に中断されているシグナルが含まれるとき、返されるシグナルが即座に同じ理由で中断される", ({
    expect,
  }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    ac2.abort("Timeout");

    // 実行
    const result = combineSignals([ac1.signal, ac2.signal]);

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("Timeout");
  });

  test("空配列を指定したとき、未中断の AbortSignal が返される", ({ expect }) => {
    // 実行
    const result = combineSignals([]);

    // 検証
    expect(result.aborted).toBe(false);
  });

  test("AbortSignal 以外の値が混入していてもエラーにならず、有効なシグナルだけが結合される", ({
    expect,
  }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();

    // 実行
    const result = combineSignals([ac1.signal, undefined, 123, ac2.signal]);

    // 検証
    expect(result.aborted).toBe(false);

    // 実行
    ac2.abort("User Cancel");

    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("User Cancel");
  });

  test("複数の既に中断されたシグナルが含まれるとき、配列順で最初のシグナルの理由が適用される", ({
    expect,
  }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    ac1.abort("Err1");
    ac2.abort("Err2");

    // 実行
    const result = combineSignals([ac1.signal, ac2.signal]);

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("Err1");
  });
}

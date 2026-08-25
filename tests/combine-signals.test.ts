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

  test("結合後に複数のシグナルが同期的に連続して中断されたとき、先に中断されたシグナルの理由が適用される", ({
    expect,
  }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const result = combineSignals([ac1.signal, ac2.signal]);

    // 実行と検証
    ac1.abort("First");
    ac2.abort("Second");
    expect(result.reason).toBe("First");
  });

  test("同一のシグナルが重複して含まれるとき、1 回の中断で返されるシグナルが中断される", ({
    expect,
  }) => {
    // 準備
    const ac = new AbortController();
    const result = combineSignals([ac.signal, ac.signal]);

    // 実行
    ac.abort("Dup");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("Dup");
  });

  test("null を理由として中断されたシグナルが含まれるとき、返されるシグナルも同じく null を理由として中断される", ({
    expect,
  }) => {
    // 準備
    const ac = new AbortController();
    ac.abort(null);

    // 実行
    const result = combineSignals([ac.signal]);

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe(null);
  });

  test("既に中断されたシグナルより前に含まれた未中断のシグナルを後から中断しても、返されるシグナルの理由は変化しない", ({
    expect,
  }) => {
    // 準備
    const live = new AbortController();
    const dead = new AbortController();
    dead.abort("Dead");

    // 実行
    const result = combineSignals([live.signal, dead.signal]);
    live.abort("Late");

    // 検証
    expect(result.reason).toBe("Dead");
  });

  test("結合されたシグナルをさらに結合したとき、元のシグナルの中断が伝播する", ({ expect }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const inner = combineSignals([ac1.signal]);
    const outer = combineSignals([inner, ac2.signal]);

    // 実行
    ac1.abort("Inner");

    // 検証
    expect(outer.aborted).toBe(true);
    expect(outer.reason).toBe("Inner");

    // 実行と検証
    ac2.abort("Outer");
    expect(outer.reason).toBe("Inner");
  });
}

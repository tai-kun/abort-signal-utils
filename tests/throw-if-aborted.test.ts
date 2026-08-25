import { describe, test as vitest } from "vitest";

import throwIfAborted from "../src/throw-if-aborted.js";

// テスト実行前のオリジナルのメソッドを保持する。
// oxlint-disable-next-line typescript/unbound-method
const originalThrowIfAborted = AbortSignal.prototype.throwIfAborted;

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{ noNativeThrowIfAborted?: boolean }>({
  /**
   * ネイティブの AbortSignal.prototype.throwIfAborted を削除した環境を提供するフィクスチャーです。
   * ポリフィル実装の動作検証のために使用します。テスト終了後には元のメソッドを復元します。
   */
  // oxlint-disable-next-line no-empty-pattern
  async noNativeThrowIfAborted({}, use) {
    // @ts-expect-error テストのためにプロパティを一時的に削除する。
    delete AbortSignal.prototype.throwIfAborted;
    await use(undefined);
    AbortSignal.prototype.throwIfAborted = originalThrowIfAborted;
  },
});

describe.skipIf(typeof originalThrowIfAborted !== "function")("ネイティブサポート環境", () => {
  defineCommonTests();
});

describe("ネイティブ非サポート環境", () => {
  test.override({ noNativeThrowIfAborted: true });

  defineCommonTests();
});

function defineCommonTests(): void {
  test("引数が undefined のとき、エラーを投げずに正常終了する", ({ expect }) => {
    // 実行と検証
    expect(() => throwIfAborted(undefined)).not.toThrow();
  });

  test("シグナルが未中止のとき、エラーを投げずに正常終了する", ({ expect }) => {
    // 準備
    const ac = new AbortController();

    // 実行と検証
    expect(() => throwIfAborted(ac.signal)).not.toThrow();
  });

  test("シグナルが理由なしで中止されたとき、AbortError の DOMException が投げられる", ({
    expect,
  }) => {
    // 準備
    const ac = new AbortController();
    ac.abort();

    // 実行と検証
    expect(() => throwIfAborted(ac.signal)).toThrow(DOMException);
  });

  test("シグナルが理由ありで中止されたとき、その理由がそのまま投げられる", ({ expect }) => {
    // 準備
    const ac = new AbortController();
    const customError = new Error("Timeout");
    ac.abort(customError);

    // 実行と検証
    expect(() => throwIfAborted(ac.signal)).toThrow(customError);
  });

  test("シグナルが null を理由として中止されたとき、 null がそのまま投げられる", ({ expect }) => {
    // 準備
    const ac = new AbortController();
    ac.abort(null);

    // 実行と検証
    let caught: unknown;
    try {
      throwIfAborted(ac.signal);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(null);
  });

  test("タイムアウトした AbortSignal.timeout のシグナルを渡すと、 TimeoutError が投げられる", async ({
    expect,
  }) => {
    // 準備
    const signal = AbortSignal.timeout(5);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 実行と検証
    let caught: unknown;
    try {
      throwIfAborted(signal);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe("TimeoutError");
  });

  test("引数が AbortSignal 以外のオブジェクトのとき、エラーを投げずに正常終了する", ({
    expect,
  }) => {
    // 準備
    const dummy = {} as unknown as AbortSignal;

    // 実行と検証
    expect(() => throwIfAborted(dummy)).not.toThrow();
  });
}

describe("境界値および異常系のテスト", () => {
  test("引数が null のとき、エラーを投げずに正常終了する", ({ expect }) => {
    // 準備
    const dummy = null as unknown as AbortSignal;

    // 実行と検証
    expect(() => throwIfAborted(dummy)).not.toThrow();
  });
});

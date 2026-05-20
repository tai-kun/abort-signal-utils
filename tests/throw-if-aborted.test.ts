import { describe, test, beforeEach, afterEach } from "vitest";

import throwIfAborted from "../src/throw-if-aborted.js";

// テスト実行前のオリジナルのメソッドを保持する。
// oxlint-disable-next-line typescript/unbound-method
const originalThrowIfAborted = AbortSignal.prototype.throwIfAborted;

describe.skipIf(typeof originalThrowIfAborted !== "function")("ネイティブサポート環境", () => {
  defineCommonTests();
});

describe("非サポート環境", () => {
  beforeEach(() => {
    // ネイティブメソッドを未定義にする。
    // @ts-expect-error テストのためにプロパティを一時的に削除する。
    delete AbortSignal.prototype.throwIfAborted;
  });

  afterEach(() => {
    // プロトタイプを元の状態に戻す。
    AbortSignal.prototype.throwIfAborted = originalThrowIfAborted;
  });

  defineCommonTests();
});

function defineCommonTests(): void {
  test("引数が undefined のとき、エラーを投げずに正常終了する", ({ expect }) => {
    // Act & Assert
    expect(() => throwIfAborted(undefined)).not.toThrow();
  });

  test("シグナルが未中止のとき、エラーを投げずに正常終了する", ({ expect }) => {
    // Arrange
    const ac = new AbortController();
    const signal = ac.signal;

    // Act & Assert
    expect(() => throwIfAborted(signal)).not.toThrow();
  });

  test("シグナルが理由なしで中止されたとき、 getAbortReason が返す AbortError の DOMException が投げられる", ({
    expect,
  }) => {
    // Arrange
    const ac = new AbortController();
    ac.abort();
    const signal = ac.signal;

    // Act & Assert
    expect(() => throwIfAborted(signal)).toThrow(DOMException);
  });

  test("シグナルが理由ありで中止されたとき、 getAbortReason が返すカスタムエラーオブジェクトが投げられる", ({
    expect,
  }) => {
    // Arrange
    const ac = new AbortController();
    const customError = new Error("Timeout");
    ac.abort(customError);
    const signal = ac.signal;

    // Act & Assert
    expect(() => throwIfAborted(signal)).toThrow(customError);
  });

  test("引数が AbortSignal 以外のオブジェクトのとき、エラーを投げずに正常終了する", ({
    expect,
  }) => {
    // Arrange
    const dummy = {} as unknown as AbortSignal;

    // Act & Assert
    expect(() => throwIfAborted(dummy)).not.toThrow();
  });
}

describe("境界値および異常系のテスト", () => {
  test("引数が null のとき、エラーを投げずに正常終了する", ({ expect }) => {
    // Arrange
    const dummy = null as unknown as AbortSignal;

    // Act & Assert
    expect(() => throwIfAborted(dummy)).not.toThrow();
  });
});

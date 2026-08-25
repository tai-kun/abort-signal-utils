import { describe, test as vitest } from "vitest";

import combineSignalsFast from "../src/combine-signals-fast.js";

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{ noNativeAny?: boolean }>({
  /**
   * ネイティブの AbortSignal.any を削除した環境を提供するフィクスチャーです。
   * 委譲先の combineSignals のポリフィル実装の動作検証のために使用します。
   * テスト終了後には元のメソッドを復元します。
   */
  // oxlint-disable-next-line no-empty-pattern
  async noNativeAny({}, use) {
    const originalAny = AbortSignal.any?.bind(AbortSignal);

    // @ts-expect-error テストのためにプロパティを一時的に削除する。
    delete AbortSignal.any;
    await use(undefined);
    if (originalAny !== undefined) {
      AbortSignal.any = originalAny;
    }
  },
});

test("有効なシグナルが 1 つのとき、新しい AbortSignal を生成せずそのシグナル自体が返される", ({
  expect,
}) => {
  // 準備
  const ac = new AbortController();

  // 実行
  const result = combineSignalsFast([ac.signal]);

  // 検証
  expect(result).toBe(ac.signal);
});

test("中止済みの有効なシグナルが 1 つのとき、そのシグナル自体が同じ理由のまま返される", ({
  expect,
}) => {
  // 準備
  const ac = new AbortController();
  ac.abort("Timeout");

  // 実行
  const result = combineSignalsFast([ac.signal]);

  // 検証
  expect(result).toBe(ac.signal);
  expect(result.aborted).toBe(true);
  expect(result.reason).toBe("Timeout");
});

test("有効なシグナルが 0 個のとき、未中止の新しい AbortSignal が返される", ({ expect }) => {
  // 実行
  const result = combineSignalsFast([]);

  // 検証
  expect(result).toBeInstanceOf(AbortSignal);
  expect(result.aborted).toBe(false);
});

test("AbortSignal 以外の値のみのとき、未中止の新しい AbortSignal が返される", ({ expect }) => {
  // 実行
  const result = combineSignalsFast([undefined, 123, "signal"]);

  // 検証
  expect(result).toBeInstanceOf(AbortSignal);
  expect(result.aborted).toBe(false);
});

test("無効な値に混ざって有効なシグナルが 1 つだけのとき、そのシグナル自体が返される", ({
  expect,
}) => {
  // 準備
  const ac = new AbortController();

  // 実行
  const result = combineSignalsFast([undefined, ac.signal, 123]);

  // 検証
  expect(result).toBe(ac.signal);
});

test("同一のシグナルが重複しているとき、2 つと判定されて結合される", ({ expect }) => {
  // 準備
  const ac = new AbortController();
  const result = combineSignalsFast([ac.signal, ac.signal]);

  // 検証
  expect(result).not.toBe(ac.signal);
  expect(result.aborted).toBe(false);

  // 実行と検証
  ac.abort("Dup");
  expect(result.aborted).toBe(true);
  expect(result.reason).toBe("Dup");
});

test("有効なシグナルが 2 つのとき、combineSignals と同じく中断が伝播する", async ({ expect }) => {
  // 準備
  const ac1 = new AbortController();
  const ac2 = new AbortController();

  // 実行と検証
  const result = combineSignalsFast([ac1.signal, ac2.signal]);
  expect(result).not.toBe(ac1.signal);
  expect(result).not.toBe(ac2.signal);

  ac2.abort("User Cancel");
  expect(result.aborted).toBe(true);
  expect(result.reason).toBe("User Cancel");
});

describe("ネイティブ非サポート環境(AbortSignal.any 未実装)", () => {
  test.override({ noNativeAny: true });

  test("有効なシグナルが 2 つのとき、ポリフィル実装でも中断が伝播する", ({ expect }) => {
    // 準備
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const result = combineSignalsFast([ac1.signal, ac2.signal]);

    // 実行と検証
    expect(result.aborted).toBe(false);

    ac1.abort("Polyfill");
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("Polyfill");
  });
});

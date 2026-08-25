import { tryCaptureStackTrace } from "try-capture-stack-trace";
import { vi, test, afterEach, beforeEach } from "vitest";

import getAbortReason from "../src/get-abort-reason.js";

vi.mock("try-capture-stack-trace", () => {
  return {
    tryCaptureStackTrace: vi.fn<() => void>(),
  };
});

const originalAbortController = globalThis.AbortController;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.AbortController = originalAbortController;
});

/**
 * 指定した理由を持つ中止済みシグナルを生成する AbortController でグローバルを置き換えます。
 * ランタイム依存のデフォルト中断理由ごとの分岐を検証するために使用します。
 * 置き換えは afterEach フックで元に戻されます。
 */
function replaceAbortController(defaultReason: unknown): void {
  globalThis.AbortController = class {
    signal = { aborted: true, reason: defaultReason };
    abort(): void {}
  } as unknown as typeof AbortController;
}

test("未中止のシグナルを渡したとき、 undefined が返される", ({ expect }) => {
  // 準備
  const ac = new AbortController();

  // 実行
  const result = getAbortReason(ac.signal);

  // 検証
  expect(result).toBeUndefined();
});

test("中止済みかつ明示的な理由として TimeoutError が指定されたとき、その理由がそのまま返される", ({
  expect,
}) => {
  // 準備
  const ac = new AbortController();
  ac.abort("TimeoutError");

  // 実行
  const result = getAbortReason(ac.signal);

  // 検証
  expect(result).toBe("TimeoutError");
});

test("中止済みかつ明示的な理由として Error オブジェクトが指定されたとき、そのオブジェクトがそのまま返される", ({
  expect,
}) => {
  // 準備
  const ac = new AbortController();
  const customError = new Error("Custom Error");
  ac.abort(customError);

  // 実行
  const result = getAbortReason(ac.signal);

  // 検証
  expect(result).toStrictEqual(customError);
});

test("中止済みかつ理由が未定義で、ランタイムのデフォルト理由がオブジェクトのとき、そのオブジェクトが返され tryCaptureStackTrace が呼び出される", ({
  expect,
}) => {
  // 準備
  const mockDefaultReason = { message: "Runtime default abort reason" };
  replaceAbortController(mockDefaultReason);
  const signal = { aborted: true, reason: undefined } as unknown as AbortSignal;

  // 実行
  const result = getAbortReason(signal);

  // 検証
  expect(result).toStrictEqual(mockDefaultReason);
  expect(tryCaptureStackTrace).toHaveBeenCalledWith(mockDefaultReason, getAbortReason);
});

test("中止済みかつ理由が null のとき、 null がそのまま返される", ({ expect }) => {
  // 準備
  const ac = new AbortController();
  ac.abort(null);

  // 実行
  const result = getAbortReason(ac.signal);

  // 検証
  expect(result).toBe(null);
});

test("AbortSignal.timeout で生成した未中止のシグナルを渡したとき、 undefined が返される", ({
  expect,
}) => {
  // 準備
  const signal = AbortSignal.timeout(10_000);

  // 実行と検証
  expect(getAbortReason(signal)).toBeUndefined();
});

test("AbortSignal.timeout で生成したシグナルがタイムアウトしたとき、 TimeoutError の DOMException が返される", async ({
  expect,
}) => {
  // 準備
  const signal = AbortSignal.timeout(5);
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 実行
  const result = getAbortReason(signal);

  // 検証
  expect(result).toBeInstanceOf(DOMException);
  expect((result as DOMException).name).toBe("TimeoutError");
});

test.for([
  ["null", null],
  ["プリミティブ値", "Primitive Abort Reason"],
] as const)(
  "中止済みかつ理由が未定義で、ランタイムのデフォルト理由が %s のとき、新規の AbortError DOMException が返され tryCaptureStackTrace が呼び出される",
  ([, defaultReason], { expect }) => {
    // 準備
    replaceAbortController(defaultReason);
    const signal = { aborted: true, reason: undefined } as unknown as AbortSignal;

    // 実行
    const result = getAbortReason(signal);

    // 検証
    expect(result).toBeInstanceOf(DOMException);
    expect((result as DOMException).name).toBe("AbortError");
    expect((result as DOMException).message).toBe("Aborted");
    expect(tryCaptureStackTrace).toHaveBeenCalledWith(result, getAbortReason);
  },
);

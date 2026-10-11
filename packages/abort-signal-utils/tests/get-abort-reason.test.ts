import { describe, test, vi } from "vitest";

import getAbortReason from "../src/get-abort-reason.js";

/**
 * 理由が undefined のまま中断している稀な状態を再現する。
 */
function createAbortedSignalWithUndefinedReason(): AbortSignal {
  const controller = new AbortController();
  controller.abort("placeholder");
  const { signal } = controller;
  Object.defineProperty(signal, "reason", {
    value: undefined,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return signal;
}

/**
 * 引数なし abort() の既定理由を差し替える。破棄時に元に戻す。
 */
function stubDefaultAbortReason(reason: unknown): Disposable {
  class StubAbortController extends AbortController {
    public override abort(): void {
      super.abort(reason);
    }
  }
  vi.stubGlobal("AbortController", StubAbortController);
  return {
    [Symbol.dispose](): void {
      vi.unstubAllGlobals();
    },
  };
}

describe("理由が取り出せる場合", () => {
  test("未中断では undefined を返す", ({ expect }) => {
    // 準備
    const controller = new AbortController();

    // 実行
    const reason = getAbortReason(controller.signal);

    // 検証
    expect(reason).toBe(undefined);
  });

  test("文字列の理由をそのまま返す", ({ expect }) => {
    // 実行
    const reason = getAbortReason(AbortSignal.abort("boom"));

    // 検証
    expect(reason).toBe("boom");
  });

  test("Error は同一インスタンスを返す", ({ expect }) => {
    // 準備
    const error = new Error("failure");
    const controller = new AbortController();
    controller.abort(error);

    // 実行
    const reason = getAbortReason(controller.signal);

    // 検証
    expect(reason).toBe(error);
  });

  test("理由なしの中断では既定の DOMException を返す", ({ expect }) => {
    // 準備
    const controller = new AbortController();
    controller.abort();

    // 実行
    const reason = getAbortReason(controller.signal);

    // 検証
    expect(reason).toBe(controller.signal.reason);
    expect(reason).toBeInstanceOf(DOMException);
    expect((reason as DOMException).name).toBe("AbortError");
  });

  test.for([
    { label: "null", makeReason: () => null },
    { label: "数値", makeReason: () => 0 },
    { label: "真偽値", makeReason: () => false },
    { label: "空文字", makeReason: () => "" },
  ] as const)("falsy な理由もそのまま返す ($label)", ({ makeReason }, { expect }) => {
    // 準備
    const reason = makeReason();
    const controller = new AbortController();
    controller.abort(reason);

    // 実行
    const actual = getAbortReason(controller.signal);

    // 検証
    expect(actual).toBe(reason);
  });
});

describe("理由が undefined のまま中断している場合", () => {
  test("ランタイムの既定理由を返す", ({ expect }) => {
    // 準備
    const signal = createAbortedSignalWithUndefinedReason();

    // 実行
    const reason = getAbortReason(signal);

    // 検証
    expect(reason).toBeInstanceOf(DOMException);
    expect((reason as DOMException).name).toBe("AbortError");
  });

  test("生成した理由にはスタックが付く", ({ expect }) => {
    // 準備
    const signal = createAbortedSignalWithUndefinedReason();

    // 実行
    const reason = getAbortReason(signal) as DOMException;

    // 検証
    expect(reason).toBeInstanceOf(DOMException);
    expect(typeof reason.stack).toBe("string");
  });

  test.for([
    { label: "null", value: null },
    { label: "文字列", value: "primitive-reason" },
  ] as const)("既定理由が $label なら新規 DOMException を返す", ({ value }, { expect }) => {
    // 準備
    const signal = createAbortedSignalWithUndefinedReason();
    using _stub = stubDefaultAbortReason(value);

    // 実行
    const reason = getAbortReason(signal);

    // 検証
    expect(reason).toBeInstanceOf(DOMException);
    expect((reason as DOMException).name).toBe("AbortError");
    expect((reason as DOMException).message).toBe("Aborted");
  });
});

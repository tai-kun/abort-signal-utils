import { describe, test } from "vitest";

import throwIfAborted from "../src/throw-if-aborted.js";

/**
 * 投げられた値（Error 以外を含む）を受け取る。
 */
function catchThrown(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("投げられなかった");
}

/**
 * AbortSignal.prototype.throwIfAborted がない環境を再現する。破棄時に元に戻す。
 */
function hideNativeThrowIfAborted(): Disposable {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "throwIfAborted");
  Object.defineProperty(AbortSignal.prototype, "throwIfAborted", {
    value: undefined,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  return {
    [Symbol.dispose](): void {
      if (descriptor === undefined) {
        delete (AbortSignal.prototype as unknown as Record<string, unknown>)["throwIfAborted"];
      } else {
        Object.defineProperty(AbortSignal.prototype, "throwIfAborted", descriptor);
      }
    },
  };
}

describe("throwIfAborted がある環境", () => {
  test.for([
    undefined,
    null,
    42,
    "abort",
    true,
    {},
    [],
    { aborted: true, reason: "fake" },
  ] as const)("AbortSignal 以外では何も投げない (%s)", (input, { expect }) => {
    // 実行と検証
    expect(() => {
      throwIfAborted(input);
    }).not.toThrow();
  });

  test("未中断では何も投げない", ({ expect }) => {
    // 準備
    const controller = new AbortController();

    // 実行と検証
    expect(() => {
      throwIfAborted(controller.signal);
    }).not.toThrow();
  });

  test("文字列の理由を投げる", ({ expect }) => {
    // 準備
    const signal = AbortSignal.abort("boom");

    // 実行と検証
    expect(
      catchThrown(() => {
        throwIfAborted(signal);
      }),
    ).toBe("boom");
  });

  test("Error は同一インスタンスを投げる", ({ expect }) => {
    // 準備
    const error = new Error("failure");
    const controller = new AbortController();
    controller.abort(error);

    // 実行と検証
    expect(
      catchThrown(() => {
        throwIfAborted(controller.signal);
      }),
    ).toBe(error);
  });

  test("理由なしの中断では既定の DOMException を投げる", ({ expect }) => {
    // 準備
    const controller = new AbortController();
    controller.abort();

    // 実行と検証
    expect(
      catchThrown(() => {
        throwIfAborted(controller.signal);
      }),
    ).toBe(controller.signal.reason);
  });

  test.for([
    { label: "null", makeReason: () => null },
    { label: "数値", makeReason: () => 0 },
    { label: "真偽値", makeReason: () => false },
  ] as const)("falsy な理由もそのまま投げる ($label)", ({ makeReason }, { expect }) => {
    // 準備
    const reason = makeReason();
    const controller = new AbortController();
    controller.abort(reason);

    // 実行と検証
    expect(
      catchThrown(() => {
        throwIfAborted(controller.signal);
      }),
    ).toBe(reason);
  });
});

describe("throwIfAborted がない環境", () => {
  test("未中断では何も投げない", ({ expect }) => {
    // 準備
    using _hide = hideNativeThrowIfAborted();
    const controller = new AbortController();

    // 実行と検証
    expect(() => {
      throwIfAborted(controller.signal);
    }).not.toThrow();
  });

  test("文字列の理由を投げる", ({ expect }) => {
    // 準備
    using _hide = hideNativeThrowIfAborted();
    const signal = AbortSignal.abort("fallback-boom");

    // 実行と検証
    expect(
      catchThrown(() => {
        throwIfAborted(signal);
      }),
    ).toBe("fallback-boom");
  });

  test("Error は同一インスタンスを投げる", ({ expect }) => {
    // 準備
    using _hide = hideNativeThrowIfAborted();
    const error = new Error("fallback-failure");
    const controller = new AbortController();
    controller.abort(error);

    // 実行と検証
    expect(
      catchThrown(() => {
        throwIfAborted(controller.signal);
      }),
    ).toBe(error);
  });

  test("理由が undefined の中断済みでは代替の DOMException を投げる", ({ expect }) => {
    // 準備
    using _hide = hideNativeThrowIfAborted();
    const controller = new AbortController();
    controller.abort("placeholder");
    Object.defineProperty(controller.signal, "reason", {
      value: undefined,
      configurable: true,
    });

    // 実行と検証
    expect(
      catchThrown(() => {
        throwIfAborted(controller.signal);
      }),
    ).toBeInstanceOf(DOMException);
  });
});

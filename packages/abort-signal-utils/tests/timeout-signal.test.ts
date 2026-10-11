import { describe, test, vi } from "vitest";

import timeoutSignal from "../src/timeout-signal.js";

/**
 * AbortSignal.timeout がない環境を再現する。
 * 破棄時に元の定義を復元する。
 */
function withoutAbortSignalTimeout(): Disposable {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
  if (descriptor !== undefined && descriptor.configurable === false) {
    throw new Error("AbortSignal.timeout is not configurable.");
  }
  delete (AbortSignal as unknown as Record<string, unknown>)["timeout"];
  return {
    [Symbol.dispose](): void {
      if (descriptor === undefined) {
        delete (AbortSignal as unknown as Record<string, unknown>)["timeout"];
      } else {
        Object.defineProperty(AbortSignal, "timeout", descriptor);
      }
    },
  };
}

describe("ms の検証", () => {
  test.for([
    { label: "undefined", value: undefined },
    { label: "null", value: null },
    { label: "文字列", value: "100" },
    { label: "数値オブジェクト", value: new Number(100) },
  ] as const)("型外では TypeError を投げる ($label)", ({ value }, { expect }) => {
    // 実行と検証
    expect(() => {
      timeoutSignal(value as unknown as number);
    }).toThrow(TypeError);
  });

  test.for([
    { label: "NaN", value: NaN },
    { label: "Infinity", value: Infinity },
    { label: "小数", value: 1.5 },
    { label: "負数", value: -1 },
    { label: "上限超え", value: Number.MAX_SAFE_INTEGER + 1 },
  ] as const)("範囲外では RangeError を投げる ($label)", ({ value }, { expect }) => {
    // 実行と検証
    expect(() => {
      timeoutSignal(value);
    }).toThrow(RangeError);
  });

  test("不正な ms は cleanupSignal によらず投げる", ({ expect }) => {
    // 準備
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行と検証
    expect(() => {
      timeoutSignal(-1, { cleanupSignal: cleanup.signal });
    }).toThrow(RangeError);
  });
});

describe("既定の振る舞い", () => {
  test("直後は未中断で時間が来たら TimeoutError で中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(100);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(100);

      // 検証
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBeInstanceOf(DOMException);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
      expect((signal.reason as DOMException).message).toBe(
        "The operation was aborted due to timeout",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test("ms が 0 でも直後は未中断で次ティックで中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(0);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(0);

      // 検証
      expect(signal.aborted).toBe(true);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  test("-0 でも 0 と同様に次ティックで中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(-0);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(0);

      // 検証
      expect(signal.aborted).toBe(true);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  test("呼び出すたびに別オブジェクトを返す", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const first = timeoutSignal(100);
      const second = timeoutSignal(100);

      // 検証
      expect(first).toBeInstanceOf(AbortSignal);
      expect(second).toBeInstanceOf(AbortSignal);
      expect(first).not.toBe(second);
      expect(first.aborted).toBe(false);
      expect(second.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("2_147_483_647 では単一タイマーで中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(2_147_483_647);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(2_147_483_647);

      // 検証
      expect(signal.aborted).toBe(true);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("reason 指定", () => {
  test("文字列の理由で中断する", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(10, { reason: "too-slow" });
      vi.advanceTimersByTime(10);

      // 検証
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe("too-slow");
    } finally {
      vi.useRealTimers();
    }
  });

  test("Error は同一インスタンスで中断する", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    try {
      const failure = new Error("failure");

      // 実行
      const signal = timeoutSignal(10, { reason: failure });
      vi.advanceTimersByTime(10);

      // 検証
      expect(signal.reason).toBe(failure);
    } finally {
      vi.useRealTimers();
    }
  });

  test.for([
    { label: "null", makeReason: () => null },
    { label: "数値", makeReason: () => 0 },
    { label: "真偽値", makeReason: () => false },
    { label: "空文字", makeReason: () => "" },
  ] as const)("falsy な理由でもそのまま中断する ($label)", ({ makeReason }, { expect }) => {
    // 準備
    vi.useFakeTimers();
    try {
      const reason = makeReason();

      // 実行
      const signal = timeoutSignal(10, { reason });
      vi.advanceTimersByTime(10);

      // 検証
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe(reason);
    } finally {
      vi.useRealTimers();
    }
  });

  test("明示的 undefined では既定 TimeoutError で中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(10, { reason: undefined });
      vi.advanceTimersByTime(10);

      // 検証
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBeInstanceOf(DOMException);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("cleanupSignal", () => {
  test("中断済み cleanup ではタイマーを作らず未中断で返す", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    try {
      const cleanup = new AbortController();
      cleanup.abort("cleanup");

      // 実行
      const signal = timeoutSignal(100, { cleanupSignal: cleanup.signal });
      vi.advanceTimersByTime(100);

      // 検証
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
      expect(signal.reason).toBe(undefined);
      expect(signal).not.toBe(cleanup.signal);
    } finally {
      vi.useRealTimers();
    }
  });

  test("タイマー発火が先なら中断理由が勝つ", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    try {
      const cleanup = new AbortController();
      const signal = timeoutSignal(10, { cleanupSignal: cleanup.signal });

      // 実行
      vi.advanceTimersByTime(10);
      cleanup.abort("cleanup");

      // 検証
      expect(signal.aborted).toBe(true);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  test("cleanup の中断が先なら未中断のまま残る", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    try {
      const cleanup = new AbortController();
      const signal = timeoutSignal(100, { cleanupSignal: cleanup.signal });

      // 実行
      cleanup.abort("cleanup");
      vi.advanceTimersByTime(100);

      // 検証
      expect(signal.aborted).toBe(false);
      expect(signal.reason).toBe(undefined);
    } finally {
      vi.useRealTimers();
    }
  });

  test("非シグナルの cleanupSignal は無視して中断する", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(10, { cleanupSignal: 42 as unknown as AbortSignal });
      vi.advanceTimersByTime(10);

      // 検証
      expect(signal.aborted).toBe(true);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  test("cleanupSignal が undefined では通常どおり中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(10, { cleanupSignal: undefined });
      vi.advanceTimersByTime(10);

      // 検証
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("分割待機", () => {
  test("2_147_483_648 では誤発火せず刻み進行で中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(2_147_483_648);
      vi.advanceTimersByTime(2_147_483_647);

      // 検証
      expect(signal.aborted).toBe(false);

      // 実行
      vi.advanceTimersByTime(1);

      // 検証
      expect(signal.aborted).toBe(true);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  test("分割中に cleanup が中断したら残りを予約しない", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      const cleanup = new AbortController();
      const signal = timeoutSignal(2_147_483_648, { cleanupSignal: cleanup.signal });

      // 実行
      vi.advanceTimersByTime(2_147_483_647);
      cleanup.abort("cleanup");
      vi.advanceTimersByTime(1);

      // 検証
      expect(signal.aborted).toBe(false);
      expect(signal.reason).toBe(undefined);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("unref がある場合", () => {
  test("unref があっても中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    const callbacks: Array<() => void> = [];
    let unrefCalls = 0;
    vi.stubGlobal("setTimeout", ((callback: () => void) => {
      callbacks.push(callback);
      return {
        unref(): void {
          unrefCalls++;
        },
      };
    }) as unknown as typeof setTimeout);
    vi.stubGlobal("clearTimeout", (() => {}) as unknown as typeof clearTimeout);
    try {
      // 実行
      const signal = timeoutSignal(10);
      for (const callback of callbacks) {
        callback();
      }

      // 検証
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBeInstanceOf(DOMException);
      expect(unrefCalls).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("AbortSignal.timeout がある環境", () => {
  test("条件が揃う場合はネイティブに委譲する", ({ expect }) => {
    // 準備
    const nativeSignal = AbortSignal.abort("native");
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(nativeSignal);
    try {
      // 実行
      const result = timeoutSignal(100);

      // 検証
      expect(spy).toHaveBeenCalledWith(100);
      expect(result).toBe(nativeSignal);
    } finally {
      spy.mockRestore();
    }
  });

  test("境界 4_294_967_295 では委譲する", ({ expect }) => {
    // 準備
    const nativeSignal = AbortSignal.abort("native");
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(nativeSignal);
    try {
      // 実行
      const result = timeoutSignal(4_294_967_295);

      // 検証
      expect(spy).toHaveBeenCalledWith(4_294_967_295);
      expect(result).toBe(nativeSignal);
    } finally {
      spy.mockRestore();
    }
  });

  test("reason 指定では委譲せず自前で中断する", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    const spy = vi.spyOn(AbortSignal, "timeout");
    try {
      // 実行
      const signal = timeoutSignal(100, { reason: "custom" });
      expect(spy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);

      // 検証
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe("custom");
    } finally {
      vi.useRealTimers();
      spy.mockRestore();
    }
  });

  test("cleanupSignal 指定では委譲せず自前で中断する", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    const spy = vi.spyOn(AbortSignal, "timeout");
    try {
      const cleanup = new AbortController();

      // 実行
      const signal = timeoutSignal(100, { cleanupSignal: cleanup.signal });
      expect(spy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);

      // 検証
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
      spy.mockRestore();
    }
  });

  test("上限超えでは委譲せず自前で受け付ける", ({ expect }) => {
    // 準備
    vi.useFakeTimers();
    const spy = vi.spyOn(AbortSignal, "timeout");
    try {
      // 実行
      const signal = timeoutSignal(4_294_967_296);

      // 検証
      expect(spy).not.toHaveBeenCalled();
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
      spy.mockRestore();
    }
  });
});

describe("AbortSignal.timeout がない環境", () => {
  test("条件が揃っても自前で中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(100);
      vi.advanceTimersByTime(100);

      // 検証
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBeInstanceOf(DOMException);
      expect((signal.reason as DOMException).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });

  test("0 でも次ティックで中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalTimeout();
    vi.useFakeTimers();
    try {
      // 実行
      const signal = timeoutSignal(0);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(0);

      // 検証
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

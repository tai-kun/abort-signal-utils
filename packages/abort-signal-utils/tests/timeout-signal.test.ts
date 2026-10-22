import { afterEach, beforeEach, describe, test, vi } from "vitest";

import timeoutSignal from "../src/timeout-signal.js";
import { hideAbortSignalTimeout, stubGlobals } from "./support.js";

/**
 * この `describe` 内のテストをフェイクタイマーで実行します。
 */
function useFakeTimersForEach(): void {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
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
  useFakeTimersForEach();

  test("直後は未中断で時間が来たら TimeoutError で中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

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
  });

  test("ms が 0 でも直後は未中断で次ティックで中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(0);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(0);

    // 検証
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });

  test("-0 でも 0 と同様に次ティックで中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(-0);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(0);

    // 検証
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });

  test("呼び出すたびに別オブジェクトを返す", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const first = timeoutSignal(100);
    const second = timeoutSignal(100);

    // 検証
    expect(first).toBeInstanceOf(AbortSignal);
    expect(second).toBeInstanceOf(AbortSignal);
    expect(first).not.toBe(second);
    expect(first.aborted).toBe(false);
    expect(second.aborted).toBe(false);
  });

  test("2_147_483_647 では単一タイマーで中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(2_147_483_647);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(2_147_483_647);

    // 検証
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });
});

describe("reason 指定", () => {
  useFakeTimersForEach();

  test("文字列の理由で中断する", ({ expect }) => {
    // 実行
    const signal = timeoutSignal(10, { reason: "too-slow" });
    vi.advanceTimersByTime(10);

    // 検証
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe("too-slow");
  });

  test("Error は同一インスタンスで中断する", ({ expect }) => {
    // 準備
    const failure = new Error("failure");

    // 実行
    const signal = timeoutSignal(10, { reason: failure });
    vi.advanceTimersByTime(10);

    // 検証
    expect(signal.reason).toBe(failure);
  });

  test.for([
    { label: "null", makeReason: () => null },
    { label: "数値", makeReason: () => 0 },
    { label: "真偽値", makeReason: () => false },
    { label: "空文字", makeReason: () => "" },
  ] as const)("falsy な理由でもそのまま中断する ($label)", ({ makeReason }, { expect }) => {
    // 準備
    const reason = makeReason();

    // 実行
    const signal = timeoutSignal(10, { reason });
    vi.advanceTimersByTime(10);

    // 検証
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
  });

  test("明示的 undefined では既定 TimeoutError で中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(10, { reason: undefined });
    vi.advanceTimersByTime(10);

    // 検証
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });
});

describe("cleanupSignal", () => {
  useFakeTimersForEach();

  test("中断済み cleanupSignal ではタイマーを作らず未中断で返す", ({ expect }) => {
    // 準備
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
  });

  test("タイマー発火が先なら中断理由が勝つ", ({ expect }) => {
    // 準備
    const cleanup = new AbortController();
    const signal = timeoutSignal(10, { cleanupSignal: cleanup.signal });

    // 実行
    vi.advanceTimersByTime(10);
    cleanup.abort("cleanup");

    // 検証
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });

  test("cleanupSignal の中断が先なら未中断のまま残る", ({ expect }) => {
    // 準備
    const cleanup = new AbortController();
    const signal = timeoutSignal(100, { cleanupSignal: cleanup.signal });

    // 実行
    cleanup.abort("cleanup");
    vi.advanceTimersByTime(100);

    // 検証
    expect(signal.aborted).toBe(false);
    expect(signal.reason).toBe(undefined);
  });

  test("非シグナルの cleanupSignal は無視して中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(10, { cleanupSignal: 42 as unknown as AbortSignal });
    vi.advanceTimersByTime(10);

    // 検証
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });

  test("cleanupSignal が undefined では通常どおり中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(10, { cleanupSignal: undefined });
    vi.advanceTimersByTime(10);

    // 検証
    expect(signal.aborted).toBe(true);
  });
});

describe("分割待機", () => {
  useFakeTimersForEach();

  test("2_147_483_648 では誤発火せず刻み進行で中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

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
  });

  test("分割中に cleanupSignal が中断したら残りを予約しない", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();
    const cleanup = new AbortController();
    const signal = timeoutSignal(2_147_483_648, { cleanupSignal: cleanup.signal });

    // 実行
    vi.advanceTimersByTime(2_147_483_647);
    cleanup.abort("cleanup");
    vi.advanceTimersByTime(1);

    // 検証
    expect(signal.aborted).toBe(false);
    expect(signal.reason).toBe(undefined);
  });
});

describe("unref がある場合", () => {
  test("unref があっても中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();
    const callbacks: Array<() => void> = [];
    let unrefCalls = 0;
    using _stubs = stubGlobals({
      setTimeout: (callback: () => void) => {
        callbacks.push(callback);
        return {
          unref(): void {
            unrefCalls++;
          },
        };
      },
      clearTimeout: () => {},
    });

    // 実行
    const signal = timeoutSignal(10);
    for (const callback of callbacks) {
      callback();
    }

    // 検証
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect(unrefCalls).toBeGreaterThan(0);
  });
});

describe("AbortSignal.timeout がある環境", () => {
  useFakeTimersForEach();

  test("条件が揃う場合はネイティブに委譲する", ({ expect }) => {
    // 準備
    const nativeSignal = AbortSignal.abort("native");
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(nativeSignal);

    // 実行
    const result = timeoutSignal(100);

    // 検証
    expect(spy).toHaveBeenCalledWith(100);
    expect(result).toBe(nativeSignal);
  });

  test("境界 4_294_967_295 では委譲する", ({ expect }) => {
    // 準備
    const nativeSignal = AbortSignal.abort("native");
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(nativeSignal);

    // 実行
    const result = timeoutSignal(4_294_967_295);

    // 検証
    expect(spy).toHaveBeenCalledWith(4_294_967_295);
    expect(result).toBe(nativeSignal);
  });

  test("reason 指定では委譲せず自前で中断する", ({ expect }) => {
    // 準備
    const spy = vi.spyOn(AbortSignal, "timeout");

    // 実行
    const signal = timeoutSignal(100, { reason: "custom" });
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);

    // 検証
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe("custom");
  });

  test("cleanupSignal 指定では委譲せず自前で中断する", ({ expect }) => {
    // 準備
    const spy = vi.spyOn(AbortSignal, "timeout");
    const cleanup = new AbortController();

    // 実行
    const signal = timeoutSignal(100, { cleanupSignal: cleanup.signal });
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);

    // 検証
    expect(signal.aborted).toBe(true);
  });

  test("上限超えでは委譲せず自前で受け付ける", ({ expect }) => {
    // 準備
    const spy = vi.spyOn(AbortSignal, "timeout");

    // 実行
    const signal = timeoutSignal(4_294_967_296);

    // 検証
    expect(spy).not.toHaveBeenCalled();
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });
});

describe("AbortSignal.timeout がない環境", () => {
  useFakeTimersForEach();

  test("条件が揃っても自前で中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(100);
    vi.advanceTimersByTime(100);

    // 検証
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBeInstanceOf(DOMException);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });

  test("0 でも次ティックで中断する", ({ expect }) => {
    // 準備
    using _hide = hideAbortSignalTimeout();

    // 実行
    const signal = timeoutSignal(0);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(0);

    // 検証
    expect(signal.aborted).toBe(true);
  });
});

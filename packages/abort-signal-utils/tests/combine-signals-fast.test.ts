import { describe, test } from "vitest";

import combineSignalsFast from "../src/combine-signals-fast.js";

describe("有効なシグナルが 1 つ以下", () => {
  test("空配列では呼び出すたびに未中断の新しいシグナルを返す", ({ expect }) => {
    // 実行
    const first = combineSignalsFast([]);
    const second = combineSignalsFast([]);

    // 検証
    expect(first).toBeInstanceOf(AbortSignal);
    expect(first.aborted).toBe(false);
    expect(second.aborted).toBe(false);
    expect(first).not.toBe(second);
  });

  test("有効なシグナルがなければ未中断の新しいシグナルを返す", ({ expect }) => {
    // 実行
    const result = combineSignalsFast([
      null,
      undefined,
      0,
      "",
      {},
      [],
      { aborted: true, reason: "fake" },
    ]);

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result.aborted).toBe(false);
  });

  test.for([
    {
      label: "先頭",
      make: () => {
        const controller = new AbortController();
        return { controller, signals: [controller.signal, null, undefined] as unknown[] };
      },
    },
    {
      label: "中央",
      make: () => {
        const controller = new AbortController();
        return { controller, signals: [null, controller.signal, 123] as unknown[] };
      },
    },
    {
      label: "末尾",
      make: () => {
        const controller = new AbortController();
        return { controller, signals: [null, {}, controller.signal] as unknown[] };
      },
    },
  ] as const)("単一の未中断シグナルは同一オブジェクトを返す ($label)", ({ make }, { expect }) => {
    // 準備
    const { controller, signals } = make();

    // 実行
    const result = combineSignalsFast(signals);

    // 検証
    expect(result).toBe(controller.signal);
  });

  test("単一の中断済みシグナルは同一オブジェクトを返す", ({ expect }) => {
    // 準備
    const signal = AbortSignal.abort("fast-aborted");

    // 実行
    const result = combineSignalsFast([null, signal]);

    // 検証
    expect(result).toBe(signal);
    expect(result.reason).toBe("fast-aborted");
  });

  test("同一オブジェクトで返したシグナルは元の中断と連動する", ({ expect }) => {
    // 準備
    const controller = new AbortController();

    // 実行
    const result = combineSignalsFast([controller.signal, null]);
    controller.abort("direct");

    // 検証
    expect(result).toBe(controller.signal);
    expect(result.reason).toBe("direct");
  });

  test("単一の未中断と有効なcleanupでは新規オブジェクトを返す", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();

    // 実行
    const result = combineSignalsFast([input.signal], { cleanupSignal: cleanup.signal });

    // 検証
    expect(result).not.toBe(input.signal);
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("単一の未中断と有効なcleanupではcleanupで追従を止められる", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignalsFast([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    cleanup.abort("cleanup");
    input.abort("late");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("単一の未中断と有効なcleanupでは入力の中断が伝わる", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignalsFast([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    input.abort("real");

    // 検証
    expect(result.reason).toBe("real");
  });

  test("中断済みのcleanupでは単一の未中断をそのまま返す", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行
    const result = combineSignalsFast([input.signal], { cleanupSignal: cleanup.signal });

    // 検証
    expect(result).toBe(input.signal);
  });

  test.for([
    { label: "有効なcleanup", makeCleanup: () => new AbortController().signal },
    {
      label: "中断済みcleanup",
      makeCleanup: () => {
        const cleanup = new AbortController();
        cleanup.abort("cleanup");
        return cleanup.signal;
      },
    },
  ] as const)(
    "中断済みの単一入力はcleanupがあっても同一オブジェクトを返す ($label)",
    ({ makeCleanup }, { expect }) => {
      // 準備
      const signal = AbortSignal.abort("already");
      const cleanup = makeCleanup();

      // 実行
      const result = combineSignalsFast([signal], { cleanupSignal: cleanup });

      // 検証
      expect(result).toBe(signal);
      expect(result.reason).toBe("already");
    },
  );

  test("cleanupSignal が undefined では単一の未中断をそのまま返す", ({ expect }) => {
    // 準備
    const input = new AbortController();

    // 実行
    const result = combineSignalsFast([input.signal], { cleanupSignal: undefined });

    // 検証
    expect(result).toBe(input.signal);
  });

  test.for([
    { label: "数値", value: 42 },
    { label: "null", value: null },
    { label: "中断済みを装うオブジェクト", value: { aborted: true } },
  ] as const)(
    "AbortSignal 以外の cleanupSignal は無視して単一の未中断をそのまま返す ($label)",
    ({ value }, { expect }) => {
      // 準備
      const input = new AbortController();

      // 実行
      const result = combineSignalsFast([input.signal], {
        cleanupSignal: value as unknown as AbortSignal,
      });

      // 検証
      expect(result).toBe(input.signal);
    },
  );

  test("空配列では有効なcleanupがあっても未中断の新規シグナルを返す", ({ expect }) => {
    // 準備
    const cleanup = new AbortController();

    // 実行
    const result = combineSignalsFast([], { cleanupSignal: cleanup.signal });

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
    expect(result).not.toBe(cleanup.signal);
  });
});

describe("有効なシグナルが 2 つ以上", () => {
  test("入力とは別の新しい結合シグナルを返す", ({ expect }) => {
    // 準備
    const first = new AbortController();
    const second = new AbortController();

    // 実行
    const result = combineSignalsFast([first.signal, second.signal]);

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result).not.toBe(first.signal);
    expect(result).not.toBe(second.signal);
    expect(result.aborted).toBe(false);
  });

  test.for([
    {
      label: "2 個",
      makeSignals: () => {
        const first = new AbortController();
        const second = new AbortController();
        return { controllers: [first, second], signals: [first.signal, second.signal] };
      },
    },
    {
      label: "無効な値を挟む",
      makeSignals: () => {
        const first = new AbortController();
        const second = new AbortController();
        return { controllers: [first, second], signals: [first.signal, null, second.signal] };
      },
    },
    {
      label: "3 個",
      makeSignals: () => {
        const first = new AbortController();
        const second = new AbortController();
        const third = new AbortController();
        return {
          controllers: [first, second, third],
          signals: [first.signal, second.signal, third.signal],
        };
      },
    },
  ] as const)("いずれかの中断で中断する ($label)", ({ makeSignals }, { expect }) => {
    // 準備
    const { controllers, signals } = makeSignals();
    const [first] = controllers;
    const result = combineSignalsFast(signals);

    // 実行
    first?.abort("delegated");

    // 検証
    expect(result.reason).toBe("delegated");
  });

  test.for([
    {
      label: "中断済みを含む",
      signals: () => [AbortSignal.abort("pre"), new AbortController().signal],
      expected: "pre",
    },
    {
      label: "2 個とも中断済み",
      signals: () => [AbortSignal.abort("one"), AbortSignal.abort("two")],
      expected: "one",
    },
  ] as const)(
    "中断済みがあれば即座に中断済みになる ($label)",
    ({ signals, expected }, { expect }) => {
      // 実行
      const result = combineSignalsFast(signals());

      // 検証
      expect(result.aborted).toBe(true);
      expect(result.reason).toBe(expected);
    },
  );

  test("2件以上と有効なcleanupではcleanupで追従を止められる", ({ expect }) => {
    // 準備
    const first = new AbortController();
    const second = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignalsFast([first.signal, second.signal], {
      cleanupSignal: cleanup.signal,
    });

    // 実行
    cleanup.abort("cleanup");
    first.abort("late");
    second.abort("late");

    // 検証
    expect(result).not.toBe(first.signal);
    expect(result).not.toBe(second.signal);
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("2件以上と有効なcleanupでは入力の中断が伝わる", ({ expect }) => {
    // 準備
    const first = new AbortController();
    const second = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignalsFast([first.signal, second.signal], {
      cleanupSignal: cleanup.signal,
    });

    // 実行
    second.abort("real");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("real");
  });
});

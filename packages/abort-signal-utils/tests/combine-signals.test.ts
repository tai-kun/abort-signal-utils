import { describe, test } from "vitest";

import combineSignals from "../src/combine-signals.js";

/**
 * AbortSignal.any がない環境を再現する。破棄時に元の定義を復元する。
 */
function withoutAbortSignalAny(): Disposable {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, "any");
  delete (AbortSignal as unknown as Record<string, unknown>)["any"];
  return {
    [Symbol.dispose](): void {
      if (descriptor === undefined) {
        delete (AbortSignal as unknown as Record<string, unknown>)["any"];
      } else {
        Object.defineProperty(AbortSignal, "any", descriptor);
      }
    },
  };
}

describe("AbortSignal.any がある環境", () => {
  test("空配列では未中断のシグナルを返す", ({ expect }) => {
    // 実行
    const result = combineSignals([]);

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("結合後に中断した理由を引き継ぐ", ({ expect }) => {
    // 準備
    const first = new AbortController();
    const second = new AbortController();
    const result = combineSignals([first.signal, second.signal]);

    // 実行
    second.abort("late");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("late");
  });

  test.for([
    { label: "1 個", signals: () => [AbortSignal.abort("already")], expected: "already" },
    {
      label: "2 個とも",
      signals: () => [AbortSignal.abort("first"), AbortSignal.abort("second")],
      expected: "first",
    },
    {
      label: "混在",
      signals: () => [new AbortController().signal, AbortSignal.abort("mixed")],
      expected: "mixed",
    },
  ] as const)(
    "中断済みがあればその理由で中断済みになる ($label)",
    ({ signals, expected }, { expect }) => {
      // 実行
      const result = combineSignals(signals());

      // 検証
      expect(result.aborted).toBe(true);
      expect(result.reason).toBe(expected);
    },
  );

  test.for([
    { label: "文字列", makeReason: () => "boom" },
    { label: "数値", makeReason: () => 42 },
    { label: "null", makeReason: () => null },
    { label: "falsy", makeReason: () => 0 },
  ] as const)("理由の値によらず同じ値を引き継ぐ ($label)", ({ makeReason }, { expect }) => {
    // 準備
    const reason = makeReason();

    // 実行
    const result = combineSignals([AbortSignal.abort(reason)]);

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe(reason);
  });

  test("Error は同一インスタンスを引き継ぐ", ({ expect }) => {
    // 準備
    const error = new Error("failure");

    // 実行
    const result = combineSignals([AbortSignal.abort(error)]);

    // 検証
    expect(result.reason).toBe(error);
  });

  test("理由なしの中断では既定の DOMException を引き継ぐ", ({ expect }) => {
    // 準備
    const controller = new AbortController();
    controller.abort();

    // 実行
    const result = combineSignals([controller.signal]);

    // 検証
    expect(result.reason).toBeInstanceOf(DOMException);
    expect((result.reason as DOMException).name).toBe("AbortError");
  });

  test("AbortSignal 以外は無視して結合する", ({ expect }) => {
    // 準備
    const controller = new AbortController();

    // 実行
    const result = combineSignals([
      null,
      undefined,
      0,
      "",
      true,
      {},
      [],
      { aborted: true, reason: "fake" },
      controller.signal,
      "x",
    ]);

    // 検証
    expect(result.aborted).toBe(false);
    controller.abort("real");
    expect(result.reason).toBe("real");
  });

  test("有効なシグナルがなければ未中断のシグナルを返す", ({ expect }) => {
    // 実行
    const result = combineSignals([null, undefined, 123, {}, "x"]);

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result.aborted).toBe(false);
  });

  test("入力配列を変更しない", ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const input: unknown[] = [controller.signal, null];

    // 実行
    combineSignals(input);

    // 検証
    expect(input.length).toBe(2);
    expect(input[0]).toBe(controller.signal);
    expect(input[1]).toBe(null);
  });

  test("cleanupの中断で入力への追従を止める", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    cleanup.abort("cleanup");
    input.abort("late");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("入力の中断でcleanupの購読を解除する", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    input.abort("input");
    cleanup.abort("cleanup");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("input");
  });

  test("中断済みのcleanupでも入力への追従は残る", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 検証
    expect(result.aborted).toBe(false);
    input.abort("real");
    expect(result.reason).toBe("real");
  });

  test("中断済み入力は中断済みcleanupより優先される", ({ expect }) => {
    // 準備
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行
    const result = combineSignals([AbortSignal.abort("input")], {
      cleanupSignal: cleanup.signal,
    });

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("input");
  });

  test("cleanupSignal が undefined では入力の中断が伝わる", ({ expect }) => {
    // 準備
    const input = new AbortController();

    // 実行
    const result = combineSignals([input.signal], { cleanupSignal: undefined });
    input.abort("real");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("real");
  });

  test("余剰プロパティは無視される", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const options = {
      cleanupSignal: cleanup.signal,
      unknownProp: "ignored",
    } as unknown as Parameters<typeof combineSignals>[1];

    // 実行
    const result = combineSignals([input.signal], options);
    cleanup.abort("cleanup");
    input.abort("late");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("同一オブジェクトが中断済みなら即座に中断する", ({ expect }) => {
    // 準備
    const controller = new AbortController();
    controller.abort("same");

    // 実行
    const result = combineSignals([controller.signal], {
      cleanupSignal: controller.signal,
    });

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("same");
  });

  test("同一オブジェクトの未中断では中断が伝わる", ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const result = combineSignals([controller.signal], {
      cleanupSignal: controller.signal,
    });

    // 実行
    controller.abort("lazy");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("lazy");
  });

  test("重複入力でもcleanupで追従を止められる", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal, input.signal], {
      cleanupSignal: cleanup.signal,
    });

    // 実行
    cleanup.abort("cleanup");
    input.abort("late");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("重複入力でも入力の中断が伝わる", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal, input.signal], {
      cleanupSignal: cleanup.signal,
    });

    // 実行
    input.abort("real");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("real");
  });

  test("空配列でも有効なcleanupがあれば未中断の新規シグナルを返す", ({ expect }) => {
    // 準備
    const cleanup = new AbortController();

    // 実行
    const result = combineSignals([], { cleanupSignal: cleanup.signal });

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
    expect(result).not.toBe(cleanup.signal);
  });
});

describe("AbortSignal.any がない環境", () => {
  test("空配列では未中断のシグナルを返す", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();

    // 実行
    const result = combineSignals([]);

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result.aborted).toBe(false);
  });

  test("単一のシグナルと連動して中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const controller = new AbortController();

    // 実行
    const result = combineSignals([controller.signal]);

    // 検証
    expect(result).not.toBe(controller.signal);
    expect(result.aborted).toBe(false);
    controller.abort("solo");
    expect(result.reason).toBe("solo");
  });

  test.for([
    { label: "単一", signals: () => [AbortSignal.abort("eager")], expected: "eager" },
    {
      label: "先頭",
      signals: () => [AbortSignal.abort("head"), new AbortController().signal],
      expected: "head",
    },
    {
      label: "末尾",
      signals: () => [new AbortController().signal, AbortSignal.abort("tail")],
      expected: "tail",
    },
    {
      label: "複数",
      signals: () => [AbortSignal.abort("one"), AbortSignal.abort("two")],
      expected: "one",
    },
  ] as const)(
    "中断済みがあれば即座に中断済みになる ($label)",
    ({ signals, expected }, { expect }) => {
      // 準備
      using _hide = withoutAbortSignalAny();

      // 実行
      const result = combineSignals(signals());

      // 検証
      expect(result.aborted).toBe(true);
      expect(result.reason).toBe(expected);
    },
  );

  test("先に中断したほうの理由になる", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const first = new AbortController();
    const second = new AbortController();
    const third = new AbortController();
    const result = combineSignals([first.signal, second.signal, third.signal]);

    // 実行
    third.abort("third");
    first.abort("ignored");

    // 検証
    expect(result.reason).toBe("third");
  });

  test("AbortSignal 以外は無視して中断済みを見つける", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();

    // 実行
    const pending = combineSignals([{ aborted: true, reason: "fake" }]);
    const aborted = combineSignals([null, AbortSignal.abort("skip"), undefined]);

    // 検証
    expect(pending.aborted).toBe(false);
    expect(aborted.reason).toBe("skip");
  });

  test("呼び出すたびに独立したシグナルを返す", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const controller = new AbortController();

    // 実行
    const first = combineSignals([controller.signal]);
    const second = combineSignals([controller.signal]);

    // 検証
    expect(first).not.toBe(second);
    expect(first).not.toBe(controller.signal);
  });

  test("cleanupの中断で入力への追従を止める", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    cleanup.abort("cleanup");
    input.abort("late");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("入力の中断でcleanupの購読を解除する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    input.abort("input");
    cleanup.abort("cleanup");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("input");
  });

  test("中断済みのcleanupでも入力への追従は残る", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const input = new AbortController();
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 検証
    expect(result.aborted).toBe(false);
    input.abort("real");
    expect(result.reason).toBe("real");
  });

  test("中断済み入力は中断済みcleanupより優先される", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行
    const result = combineSignals([AbortSignal.abort("input")], {
      cleanupSignal: cleanup.signal,
    });

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("input");
  });

  test("cleanupSignal が undefined では入力の中断が伝わる", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const input = new AbortController();

    // 実行
    const result = combineSignals([input.signal], { cleanupSignal: undefined });
    input.abort("real");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("real");
  });

  test("余剰プロパティは無視される", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const input = new AbortController();
    const cleanup = new AbortController();
    const options = {
      cleanupSignal: cleanup.signal,
      unknownProp: "ignored",
    } as unknown as Parameters<typeof combineSignals>[1];

    // 実行
    const result = combineSignals([input.signal], options);
    cleanup.abort("cleanup");
    input.abort("late");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("同一オブジェクトが中断済みなら即座に中断する", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const controller = new AbortController();
    controller.abort("same");

    // 実行
    const result = combineSignals([controller.signal], {
      cleanupSignal: controller.signal,
    });

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("same");
  });

  test("同一オブジェクトの未中断では中断が伝わる", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const controller = new AbortController();
    const result = combineSignals([controller.signal], {
      cleanupSignal: controller.signal,
    });

    // 実行
    controller.abort("lazy");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("lazy");
  });

  test("重複入力でもcleanupで追従を止められる", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal, input.signal], {
      cleanupSignal: cleanup.signal,
    });

    // 実行
    cleanup.abort("cleanup");
    input.abort("late");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("重複入力でも入力の中断が伝わる", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal, input.signal], {
      cleanupSignal: cleanup.signal,
    });

    // 実行
    input.abort("real");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("real");
  });

  test("空配列でも有効なcleanupがあれば未中断の新規シグナルを返す", ({ expect }) => {
    // 準備
    using _hide = withoutAbortSignalAny();
    const cleanup = new AbortController();

    // 実行
    const result = combineSignals([], { cleanupSignal: cleanup.signal });

    // 検証
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
    expect(result).not.toBe(cleanup.signal);
  });
});

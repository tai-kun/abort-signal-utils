import { afterEach, beforeEach, describe, test, vi } from "vitest";

import combineSignals from "../src/combine-signals.js";
import { hideAbortSignalAny, noopDisposable } from "./support.js";

type Mode = {
  readonly label: string;
  readonly setup: () => Disposable;
};

const modes: readonly Mode[] = [
  { label: "AbortSignal.any がある環境", setup: noopDisposable },
  { label: "AbortSignal.any がない環境", setup: hideAbortSignalAny },
];

describe.for(modes)("$label", ({ setup }) => {
  let mode: Disposable = noopDisposable();

  beforeEach(() => {
    mode = setup();
  });

  afterEach(() => {
    mode[Symbol.dispose]();
  });

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

  test("単一のシグナルと連動して中断する", ({ expect }) => {
    // 準備
    const controller = new AbortController();

    // 実行
    const result = combineSignals([controller.signal]);

    // 検証
    expect(result).not.toBe(controller.signal);
    expect(result.aborted).toBe(false);
    controller.abort("solo");
    expect(result.reason).toBe("solo");
  });

  test("呼び出すたびに独立したシグナルを返す", ({ expect }) => {
    // 準備
    const controller = new AbortController();

    // 実行
    const first = combineSignals([controller.signal]);
    const second = combineSignals([controller.signal]);

    // 検証
    expect(first).not.toBe(second);
    expect(first).not.toBe(controller.signal);
  });

  test("先に中断したほうの理由になる", ({ expect }) => {
    // 準備
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

  test.for([
    { label: "単一", signals: () => [AbortSignal.abort("eager")], expected: "eager" },
    {
      label: "先頭",
      signals: () => [AbortSignal.abort("head"), new AbortController().signal],
      expected: "head",
    },
    {
      label: "中央",
      signals: () => [
        new AbortController().signal,
        AbortSignal.abort("middle"),
        new AbortController().signal,
      ],
      expected: "middle",
    },
    {
      label: "末尾",
      signals: () => [new AbortController().signal, AbortSignal.abort("tail")],
      expected: "tail",
    },
    {
      label: "複数",
      signals: () => [AbortSignal.abort("first"), AbortSignal.abort("second")],
      expected: "first",
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

  test("AbortSignal 以外を挟んでも中断済みを見つける", ({ expect }) => {
    // 準備
    const pending = new AbortController();

    // 実行
    const result = combineSignals([null, pending.signal, 0, AbortSignal.abort("skip"), {}]);

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("skip");
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

  test("cleanupSignal の中断で入力への追従を止める", ({ expect }) => {
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

  test("入力の中断で cleanupSignal の購読を解除する", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });
    const removeEventListener = vi.spyOn(cleanup.signal, "removeEventListener");

    // 実行
    input.abort("input");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("input");
    expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  test("入力の中断中に cleanupSignal が中断しても入力の理由で中断する", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    input.signal.addEventListener("abort", () => {
      cleanup.abort("cleanup");
    });
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    input.abort("input");

    // 検証
    expect(result.aborted).toBe(true);
    expect(result.reason).toBe("input");
  });

  test("cleanupSignal の中断中に入力が中断しても未中断のまま残る", ({ expect }) => {
    // 準備
    const input = new AbortController();
    const cleanup = new AbortController();
    cleanup.signal.addEventListener("abort", () => {
      input.abort("input");
    });
    const result = combineSignals([input.signal], { cleanupSignal: cleanup.signal });

    // 実行
    cleanup.abort("cleanup");

    // 検証
    expect(result.aborted).toBe(false);
    expect(result.reason).toBe(undefined);
  });

  test("中断済みの cleanupSignal でも入力への追従は残る", ({ expect }) => {
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

  test("中断済み入力は中断済み cleanupSignal より優先される", ({ expect }) => {
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

  test.for([
    { label: "数値", value: 42 },
    { label: "null", value: null },
    { label: "中断済みを装うオブジェクト", value: { aborted: true } },
  ] as const)("AbortSignal 以外の cleanupSignal は無視する ($label)", ({ value }, { expect }) => {
    // 準備
    const input = new AbortController();

    // 実行
    const result = combineSignals([input.signal], {
      cleanupSignal: value as unknown as AbortSignal,
    });
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

  test("重複入力でも cleanupSignal で追従を止められる", ({ expect }) => {
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

  test("空配列でも有効な cleanupSignal があれば未中断の新規シグナルを返す", ({ expect }) => {
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

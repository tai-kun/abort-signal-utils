import { describe, test } from "vitest";

import toAbortPromise from "../src/to-abort-promise.js";
import { createAbortedSignalWithUndefinedReason, isStillPending } from "./support.js";

describe("未中断の場合", () => {
  test.for([
    undefined,
    null,
    42,
    "abort",
    true,
    {},
    [],
    { aborted: true, reason: "fake" },
  ] as const)("AbortSignal 以外では未確定のまま残る (%s)", async (input, { expect }) => {
    // 実行と検証
    await expect(isStillPending(toAbortPromise(input))).resolves.toBe(true);
  });

  test("中断するまでは未確定のまま残る", async ({ expect }) => {
    // 準備
    const controller = new AbortController();

    // 実行と検証
    await expect(isStillPending(toAbortPromise(controller.signal))).resolves.toBe(true);
  });

  test("中断で中断理由で拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const result = toAbortPromise(controller.signal);

    // 実行
    controller.abort("boom");

    // 検証
    await expect(Promise.resolve(result)).rejects.toBe("boom");
  });
});

describe("中断済みの場合", () => {
  test("即座に拒否される", async ({ expect }) => {
    // 実行と検証
    await expect(Promise.resolve(toAbortPromise(AbortSignal.abort("already")))).rejects.toBe(
      "already",
    );
  });

  test("Error は同一インスタンスで拒否される", async ({ expect }) => {
    // 準備
    const error = new Error("failure");

    // 実行と検証
    await expect(Promise.resolve(toAbortPromise(AbortSignal.abort(error)))).rejects.toBe(error);
  });

  test.for([
    { label: "null", makeReason: () => null },
    { label: "数値", makeReason: () => 0 },
    { label: "真偽値", makeReason: () => false },
    { label: "空文字", makeReason: () => "" },
  ] as const)("falsy な理由でも拒否される ($label)", async ({ makeReason }, { expect }) => {
    // 準備
    const reason = makeReason();

    // 実行と検証
    await expect(Promise.resolve(toAbortPromise(AbortSignal.abort(reason)))).rejects.toBe(reason);
  });

  test("理由なしの中断では既定の DOMException で拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    controller.abort();
    const promise = Promise.resolve(toAbortPromise(controller.signal));

    // 実行と検証
    await expect(promise).rejects.toBeInstanceOf(DOMException);
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  test("理由が undefined の中断済みでは代替の DOMException で拒否される", async ({ expect }) => {
    // 準備
    const signal = createAbortedSignalWithUndefinedReason();

    // 実行と検証
    await expect(Promise.resolve(toAbortPromise(signal))).rejects.toBeInstanceOf(DOMException);
  });
});

describe("購読の解除", () => {
  test("dispose 後は中断しても未確定のまま残る", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const wait = toAbortPromise(controller.signal);

    // 実行
    wait.dispose();
    controller.abort("boom");

    // 検証
    await expect(isStillPending(wait)).resolves.toBe(true);
  });

  test("cleanupSignal の中断で待ちが止まる", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const cleanup = new AbortController();
    const wait = toAbortPromise(controller.signal, { cleanupSignal: cleanup.signal });

    // 実行
    cleanup.abort("cleanup");
    controller.abort("boom");

    // 検証
    await expect(isStillPending(wait)).resolves.toBe(true);
  });

  test("signal の中断後は cleanupSignal の中断が何もしない", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const cleanup = new AbortController();
    const wait = toAbortPromise(controller.signal, { cleanupSignal: cleanup.signal });
    const settled = Promise.resolve(wait);

    // 実行
    controller.abort("boom");
    cleanup.abort("cleanup");

    // 検証
    await expect(settled).rejects.toBe("boom");
  });

  test("cleanupSignal が undefined では signal の中断で拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const wait = toAbortPromise(controller.signal, { cleanupSignal: undefined });

    // 実行
    controller.abort("boom");

    // 検証
    await expect(Promise.resolve(wait)).rejects.toBe("boom");
  });

  test.for([
    { label: "数値", value: 42 },
    { label: "null", value: null },
    { label: "中断済みを装うオブジェクト", value: { aborted: true } },
  ] as const)(
    "AbortSignal 以外の cleanupSignal は無視する ($label)",
    async ({ value }, { expect }) => {
      // 準備
      const controller = new AbortController();
      const wait = toAbortPromise(controller.signal, {
        cleanupSignal: value as unknown as AbortSignal,
      });

      // 実行
      controller.abort("boom");

      // 検証
      await expect(Promise.resolve(wait)).rejects.toBe("boom");
    },
  );

  test("Symbol.dispose は dispose の別名である", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const wait = toAbortPromise(controller.signal);

    // 実行
    const usable = typeof Symbol.dispose === "symbol";

    // 検証
    if (!usable) {
      return;
    }

    // oxlint-disable-next-line typescript/unbound-method -- エイリアス同一性の表明のため。
    expect(wait[Symbol.dispose]).toBe(wait.dispose);
    wait[Symbol.dispose]();
    controller.abort("boom");
    await expect(isStillPending(wait)).resolves.toBe(true);
  });

  test("同一シグナルでは中断で拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const wait = toAbortPromise(controller.signal, { cleanupSignal: controller.signal });

    // 実行
    controller.abort("boom");

    // 検証
    await expect(Promise.resolve(wait)).rejects.toBe("boom");
  });

  test("同一シグナルでも dispose 先行なら未確定のまま残る", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const wait = toAbortPromise(controller.signal, { cleanupSignal: controller.signal });

    // 実行
    wait.dispose();
    controller.abort("boom");

    // 検証
    await expect(isStillPending(wait)).resolves.toBe(true);
  });

  test("中断済み signal は cleanup があっても即座に拒否される", async ({ expect }) => {
    // 準備
    const cleanup = new AbortController();

    // 実行
    const wait = toAbortPromise(AbortSignal.abort("already"), {
      cleanupSignal: cleanup.signal,
    });

    // 検証
    await expect(Promise.resolve(wait)).rejects.toBe("already");
  });

  test("中断済み同士では signal の理由で即座に拒否される", async ({ expect }) => {
    // 準備
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行と検証
    await expect(
      Promise.resolve(
        toAbortPromise(AbortSignal.abort("already"), { cleanupSignal: cleanup.signal }),
      ),
    ).rejects.toBe("already");
  });

  test("中断済み cleanup では未中断 signal でも未確定のまま残る", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行
    const wait = toAbortPromise(controller.signal, { cleanupSignal: cleanup.signal });
    controller.abort("boom");

    // 検証
    await expect(isStillPending(wait)).resolves.toBe(true);
  });

  test("dispose は二重に呼んでも安全である", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const wait = toAbortPromise(controller.signal);

    // 実行
    wait.dispose();
    wait.dispose();
    controller.abort("boom");

    // 検証
    await expect(isStillPending(wait)).resolves.toBe(true);
  });

  test("発火後に dispose を呼んでも安全である", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const wait = toAbortPromise(controller.signal);
    const settled = Promise.resolve(wait);

    // 実行
    controller.abort("boom");
    wait.dispose();

    // 検証
    await expect(settled).rejects.toBe("boom");
  });

  test("signal 以外では cleanup があっても未確定のまま残る", async ({ expect }) => {
    // 準備
    const cleanup = new AbortController();
    cleanup.abort("cleanup");

    // 実行
    const wait = toAbortPromise(42, { cleanupSignal: cleanup.signal });

    // 検証
    await expect(isStillPending(wait)).resolves.toBe(true);
  });
});

import { describe, test } from "vitest";

import withSignal from "../src/with-signal.js";
import { hideNativeThrowIfAborted } from "./support.js";

describe("中断済みの場合", () => {
  test("作業を呼ばず中断理由で拒否される", async ({ expect }) => {
    // 準備
    const signal = AbortSignal.abort("boom");
    let calls = 0;
    const task = (): string => {
      calls++;

      return "ok";
    };

    // 実行
    const result = withSignal(signal, task);

    // 検証
    await expect(result).rejects.toBe("boom");
    expect(calls).toBe(0);
  });

  test("Error は同一インスタンスで拒否される", async ({ expect }) => {
    // 準備
    const failure = new Error("failure");
    const signal = AbortSignal.abort(failure);
    let calls = 0;
    const task = (): string => {
      calls++;

      return "ok";
    };

    // 実行
    const result = withSignal(signal, task);

    // 検証
    await expect(result).rejects.toBe(failure);
    expect(calls).toBe(0);
  });

  test.for([
    { label: "null", makeReason: () => null },
    { label: "数値", makeReason: () => 0 },
    { label: "真偽値", makeReason: () => false },
    { label: "空文字", makeReason: () => "" },
  ] as const)(
    "falsy な理由でも作業を呼ばず拒否される ($label)",
    async ({ makeReason }, { expect }) => {
      // 準備
      const reason = makeReason();
      const controller = new AbortController();
      controller.abort(reason);
      let calls = 0;
      const task = (): string => {
        calls++;

        return "ok";
      };

      // 実行
      const result = withSignal(controller.signal, task);

      // 検証
      await expect(result).rejects.toBe(reason);
      expect(calls).toBe(0);
    },
  );

  test("理由なしの中断では既定の理由で拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    controller.abort();
    const reason = controller.signal.reason;
    let calls = 0;
    const task = (): string => {
      calls++;

      return "ok";
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).rejects.toBe(reason);
    expect(reason).toBeInstanceOf(DOMException);
    expect((reason as DOMException).name).toBe("AbortError");
    expect(calls).toBe(0);
  });
});

describe("未中断の場合", () => {
  test("解決値で確定する", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    let calls = 0;
    const task = (): Promise<string> => {
      calls++;

      return Promise.resolve("ok");
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).resolves.toBe("ok");
    expect(calls).toBe(1);
  });

  test("非Promiseの値で確定する", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    let calls = 0;
    const task = (): number => {
      calls++;

      return 42;
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).resolves.toBe(42);
    expect(calls).toBe(1);
  });

  test("多重Promiseは平坦化されて確定する", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    let calls = 0;
    const task = (): Promise<Promise<string>> => {
      calls++;

      return new Promise<Promise<string>>((resolve) => {
        resolve(Promise.resolve("nested"));
      });
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).resolves.toBe("nested");
    expect(calls).toBe(1);
  });

  test("拒否で拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const failure = "async-boom";
    let calls = 0;
    const task = (): Promise<string> => {
      calls++;

      return Promise.reject(failure);
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).rejects.toBe(failure);
    expect(calls).toBe(1);
  });

  test("Error は同一インスタンスで拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const failure = new Error("failure");
    let calls = 0;
    const task = (): Promise<string> => {
      calls++;

      return Promise.reject(failure);
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).rejects.toBe(failure);
    expect(calls).toBe(1);
  });

  test("同期throwで拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    const failure = new Error("sync-boom");
    let calls = 0;
    const task = (): string => {
      calls++;

      throw failure;
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).rejects.toBe(failure);
    expect(calls).toBe(1);
  });

  test.for([
    { label: "null", value: null },
    { label: "数値", value: 0 },
    { label: "真偽値", value: false },
    { label: "空文字", value: "" },
  ] as const)("falsy な値でも確定する ($label)", async ({ value }, { expect }) => {
    // 準備
    const controller = new AbortController();
    let calls = 0;
    const task = (): unknown => {
      calls++;

      return value;
    };

    // 実行
    const result = withSignal(controller.signal, task);

    // 検証
    await expect(result).resolves.toBe(value);
    expect(calls).toBe(1);
  });
});

describe("競合の場合", () => {
  test("中断が先なら中断理由で拒否される", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    let calls = 0;
    let resolveTask!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      resolveTask = resolve;
    });
    const task = (): Promise<string> => {
      calls++;

      return pending;
    };

    // 実行
    const result = withSignal(controller.signal, task);
    controller.abort("boom");

    // 検証
    await expect(result).rejects.toBe("boom");
    resolveTask("late");
    await expect(pending).resolves.toBe("late");
    expect(calls).toBe(1);
  });

  test("作業が先なら作業結果で確定する", async ({ expect }) => {
    // 準備
    const controller = new AbortController();
    let calls = 0;
    let resolveTask!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      resolveTask = resolve;
    });
    const task = (): Promise<string> => {
      calls++;

      return pending;
    };

    // 実行
    const result = withSignal(controller.signal, task);
    resolveTask("win");
    controller.abort("late-boom");

    // 検証
    await expect(result).resolves.toBe("win");
    expect(calls).toBe(1);
  });
});

describe("throwIfAborted がない環境", () => {
  test("中断済みなら作業を呼ばず拒否される", async ({ expect }) => {
    // 準備
    using _hide = hideNativeThrowIfAborted();
    const signal = AbortSignal.abort("fallback-boom");
    let calls = 0;
    const task = (): string => {
      calls++;

      return "ok";
    };

    // 実行
    const result = withSignal(signal, task);

    // 検証
    await expect(result).rejects.toBe("fallback-boom");
    expect(calls).toBe(0);
  });
});

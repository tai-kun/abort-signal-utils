import { expectTypeOf, test } from "vitest";

import combineSignalsFast from "../src/combine-signals-fast.js";
import combineSignals from "../src/combine-signals.js";
import getAbortReason from "../src/get-abort-reason.js";
import * as entrypoint from "../src/index.js";
import throwIfAborted from "../src/throw-if-aborted.js";
import toAbortPromise from "../src/to-abort-promise.js";
import type { AbortPromiseLike, ToAbortPromiseOptions } from "../src/to-abort-promise.js";

test("各関数を再エクスポートする", ({ expect }) => {
  // 検証
  expect(entrypoint.combineSignals).toBe(combineSignals);
  expect(entrypoint.combineSignalsFast).toBe(combineSignalsFast);
  expect(entrypoint.getAbortReason).toBe(getAbortReason);
  expect(entrypoint.throwIfAborted).toBe(throwIfAborted);
  expect(entrypoint.toAbortPromise).toBe(toAbortPromise);
});

test("toAbortPromiseの型の契約を満たす", () => {
  // 検証
  expectTypeOf<ReturnType<typeof toAbortPromise>>().toMatchTypeOf<AbortPromiseLike>();
  expectTypeOf<AbortPromiseLike>().toMatchTypeOf<PromiseLike<never>>();
  expectTypeOf<AbortPromiseLike>().toMatchTypeOf<Disposable>();
  expectTypeOf<AbortPromiseLike["dispose"]>().toEqualTypeOf<() => void>();
  expectTypeOf<ToAbortPromiseOptions["cleanupSignal"]>().toEqualTypeOf<AbortSignal | undefined>();
});

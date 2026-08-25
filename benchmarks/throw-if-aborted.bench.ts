import { bench, beforeAll, describe } from "vitest";

import getAbortReason from "../src/get-abort-reason.js";
import throwIfAborted from "../src/throw-if-aborted.js";

const liveSignal = new AbortController().signal;

const abortedWithReasonController = new AbortController();
abortedWithReasonController.abort(new Error("Timeout"));

// 実際のランタイムでは abort() が既定理由を設定するため、「中止済みかつ理由 undefined」はモックシグナルで再現する(テストと同じ手法)。
const abortedWithUndefinedReason = {
  aborted: true,
  reason: undefined,
} as unknown as AbortSignal;

let timeoutSignal: AbortSignal = undefined as unknown as AbortSignal;

beforeAll(async () => {
  const signal = AbortSignal.timeout(5);
  await new Promise((resolve) => setTimeout(resolve, 50));
  timeoutSignal = signal;
});

describe("throwIfAborted", () => {
  bench("未中止のシグナル(ホットパス)", () => {
    throwIfAborted(liveSignal);
  });

  bench("中止済み・理由あり", () => {
    throwIfAborted(abortedWithReasonController.signal);
  });

  bench("中止済み・理由 undefined(getAbortReason スローパス)", () => {
    throwIfAborted(abortedWithUndefinedReason);
  });

  bench("タイムアウト済み signal.timeout", () => {
    throwIfAborted(timeoutSignal);
  });

  bench("引数が undefined", () => {
    throwIfAborted(undefined);
  });

  bench("引数が AbortSignal 以外のオブジェクト", () => {
    throwIfAborted({});
  });

  bench("[比較用] ネイティブ signal.throwIfAborted 未中止", () => {
    if (typeof AbortSignal.prototype.throwIfAborted === "function") {
      liveSignal.throwIfAborted();
    }
  });
});

describe("getAbortReason", () => {
  bench("未中止のシグナル(ホットパス)", () => {
    getAbortReason(liveSignal);
  });

  bench("中止済み・理由あり", () => {
    getAbortReason(abortedWithReasonController.signal);
  });

  bench("中止済み・理由 undefined(AbortController 生成を含むスローパス)", () => {
    getAbortReason(abortedWithUndefinedReason);
  });

  bench("[比較用] signal.aborted 参照のみ", () => {
    void liveSignal.aborted;
  });
});

import getAbortReason from "./get-abort-reason.js";

/**
 * 指定された AbortSignal がすでに中止されている場合、対応するエラーを投げます。
 *
 * @param signal 監視対象の AbortSignal オブジェクトです。
 */
export default function throwIfAborted(signal: unknown): void {
  if (!(signal instanceof AbortSignal)) {
    return;
  }

  // 毎回検出しているのは、テストのように実行時にプロトタイプが書き換えられる状況でも正しくフォールバックできるようにするためです。
  if (typeof AbortSignal.prototype.throwIfAborted === "function") {
    signal.throwIfAborted();
  } else if (signal.aborted) {
    throw getAbortReason(signal);
  }
}

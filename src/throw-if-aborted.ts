import getAbortReason from "./get-abort-reason.js";

/**
 * 指定された AbortSignal がすでに中止されている場合、対応するエラーを投げます。
 *
 * @param signal 監視対象の AbortSignal オブジェクトです。
 */
export default function throwIfAborted(signal: unknown): void {
  if (signal instanceof AbortSignal) {
    if (
      "throwIfAborted" in AbortSignal.prototype &&
      typeof AbortSignal.prototype.throwIfAborted === "function"
    ) {
      if (signal instanceof AbortSignal) {
        signal.throwIfAborted();
      }
    } else if (signal.aborted) {
      throw getAbortReason(signal);
    }
  }
}

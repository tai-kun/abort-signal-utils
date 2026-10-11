import getAbortReason from "./get-abort-reason.js";

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/inspect-abort#throw-if-aborted)
 */
export default function throwIfAborted(signal: unknown): void {
  if (signal instanceof AbortSignal) {
    // 実行時に組み込みが追加・削除される場合に備えて、呼び出すたびに判定します。
    if (typeof AbortSignal.prototype.throwIfAborted === "function") {
      signal.throwIfAborted();
    } else if (signal.aborted) {
      throw getAbortReason(signal);
    }
  }
}

import getAbortReason from "./get-abort-reason.js";

/**
 * 中断済みなら中断理由を投げます。
 *
 * AbortSignal 以外の値は、何もせずに無視します。AbortSignal.prototype.throwIfAborted がある環境ではそれに委譲します。ない環境では中断理由を直接投げます。
 *
 * @param signal 調べる値です。AbortSignal 以外なら何もしません。
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

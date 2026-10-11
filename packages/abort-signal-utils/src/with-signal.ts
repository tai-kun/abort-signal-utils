import throwIfAborted from "./throw-if-aborted.js";
import toAbortPromise from "./to-abort-promise.js";

/**
 * 中断可能な作業を1回だけ実行します。
 * 中断済みなら作業を呼ばず中断理由で拒否されます。
 * 未中断なら作業を1回呼び、作業と中断を競合させます。
 * 確定後は中断待ちの購読を解除します。
 *
 * @param signal 中断を監視する AbortSignal です。
 * @param task 実行する作業です。
 * @returns 作業の結果で確定する Promise です。
 */
export default async function withSignal<T>(
  signal: AbortSignal,
  task: () => T,
): Promise<Awaited<T>> {
  throwIfAborted(signal);

  const wait = toAbortPromise(signal);

  try {
    return await Promise.race([task(), wait]);
  } finally {
    wait.dispose();
  }
}

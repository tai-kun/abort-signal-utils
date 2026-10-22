/**
 * `AbortSignal` として扱える値だけを取り出します。
 *
 * 任意の値を受け取る API で、非シグナルを無視するために使います。
 */
export default function asAbortSignal(value: unknown): AbortSignal | undefined {
  return value instanceof AbortSignal ? value : undefined;
}

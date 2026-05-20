import { tryCaptureStackTrace } from "try-capture-stack-trace";

/**
 * 指定された AbortSignal から中止の理由を取得します。
 *
 * シグナルが中止されていない場合は undefined を返し、シグナルに理由が設定されている場合はその理由を返します。理由が設定されていない場合は、代替として新規に生成した DOMException オブジェクトを返します。
 *
 * @param signal 中止の理由を取得するための AbortSignal オブジェクトです。
 * @returns 中止の理由です。シグナルがまだ中止されていない場合は undefined を返します。
 */
export default function getAbortReason(signal: AbortSignal) {
  if (!signal.aborted) {
    return undefined;
  }

  if (signal.reason !== undefined) {
    return signal.reason;
  }

  // 生成した AbortController からデフォルトの中断理由（ランタイム依存）を抽出します。
  // reason が設定されていなければ DOMException("Aborted", "AbortError") を新規生成してフォールバックとします。
  const ac = new AbortController();
  ac.abort();
  const reason =
    ac.signal.reason !== null && typeof ac.signal.reason === "object"
      ? ac.signal.reason
      : new DOMException("Aborted", "AbortError");

  tryCaptureStackTrace(reason, getAbortReason);

  return reason;
}

import { tryCaptureStackTrace } from "try-capture-stack-trace";

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/inspect-abort#get-abort-reason)
 */
export default function getAbortReason(signal: AbortSignal): unknown {
  if (!signal.aborted) {
    return undefined;
  }

  // null や 0 などの falsy な理由もそのまま返すため、?? ではなく !== undefined で判定します。
  if (signal.reason !== undefined) {
    return signal.reason;
  }

  return fallbackAbortReason();
}

/**
 * ランタイム既定の中断理由を取り出します。
 *
 * 既定理由がオブジェクト以外になる特殊な環境では、新規の DOMException を生成して返します。
 */
function fallbackAbortReason(): unknown {
  const controller = new AbortController();
  controller.abort();
  const reason: unknown = controller.signal.reason;

  if (typeof reason === "object" && reason !== null) {
    tryCaptureStackTrace(reason, getAbortReason);

    return reason;
  }

  const fallback = new DOMException("Aborted", "AbortError");
  tryCaptureStackTrace(fallback, getAbortReason);

  return fallback;
}

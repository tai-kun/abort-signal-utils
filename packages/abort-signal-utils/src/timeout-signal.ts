/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/timeout-signal)
 */
export type TimeoutSignalOptions = {
  /**
   * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/timeout-signal)
   */
  // oxlint-disable-next-line typescript/no-redundant-type-constituents -- unknown と undefined の併記で選択肢の形状を統一します。
  readonly reason?: unknown | undefined;
  /**
   * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/timeout-signal#cleanup)
   */
  readonly cleanupSignal?: AbortSignal | undefined;
};

const MAX_TIMEOUT_MS = 2_147_483_647;

const MAX_DELEGATABLE_MS = 4_294_967_295;

/**
 * [API Reference](https://tai-kun.github.io/abort-signal-utils/api/timeout-signal)
 */
export default function timeoutSignal(ms: number, options: TimeoutSignalOptions = {}): AbortSignal {
  if (typeof ms !== "number") {
    // 型外は即座に投げて誤った時間での沈黙を避けます。
    throw new TypeError("timeoutSignal: ms must be a number.");
  }

  if (!Number.isInteger(ms) || ms < 0 || ms > Number.MAX_SAFE_INTEGER) {
    // 小数と範囲外は即座に投げて誤った時間での沈黙を避けます。
    throw new RangeError(
      "timeoutSignal: ms must be an integer between 0 and Number.MAX_SAFE_INTEGER.",
    );
  }

  const { reason, cleanupSignal } = options;

  const cleanup = cleanupSignal instanceof AbortSignal ? cleanupSignal : undefined;

  if (cleanup?.aborted) {
    // 中断済みの cleanupSignal ではタイマーを作らず未中断のまま残します。
    return new AbortController().signal;
  }

  if (
    reason === undefined &&
    cleanupSignal === undefined &&
    ms <= MAX_DELEGATABLE_MS &&
    typeof AbortSignal.timeout === "function"
  ) {
    // 条件が揃う場合はネイティブに委譲します。
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function handleCleanup(): void {
    // cleanupSignal ではタイマーを止めて未中断のまま残します。
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    // 以後の発火を止めるため購読を解除します。
    cleanup?.removeEventListener("abort", handleCleanup);
  }

  function unrefTimeout(id: ReturnType<typeof setTimeout>): void {
    // unref がある環境ではタイマー単独で待機を続けません。
    if (typeof (id as { unref?: unknown }).unref === "function") {
      (id as unknown as { unref: () => void }).unref();
    }
  }

  function scheduleTimeout(remaining: number): void {
    // 残量に応じて単一か分割かを決めて予約します。
    const delay = remaining <= MAX_TIMEOUT_MS ? remaining : MAX_TIMEOUT_MS;
    // -0 を 0 に正規化して次ティックで中断します。
    const normalizedDelay = delay <= 0 ? 0 : delay;
    timeoutId = setTimeout(() => {
      if (remaining <= MAX_TIMEOUT_MS) {
        // 時間が来たら cleanupSignal の購読を解除します。
        cleanup?.removeEventListener("abort", handleCleanup);

        // 発火時に理由を決めて中断します。
        if (reason === undefined) {
          // 既定理由は発火時に生成します。
          controller.abort(
            new DOMException("The operation was aborted due to timeout", "TimeoutError"),
          );
        } else {
          controller.abort(reason);
        }
      } else {
        // 上限を超える残量は分割して待ちます。
        scheduleTimeout(remaining - MAX_TIMEOUT_MS);
      }
    }, normalizedDelay);

    // 最新ハンドルのみ保持して unref します。
    unrefTimeout(timeoutId);
  }

  if (cleanup !== undefined) {
    // cleanupSignal はタイマーの前に登録します。
    cleanup.addEventListener("abort", handleCleanup, { once: true });
  }

  scheduleTimeout(ms);

  return controller.signal;
}

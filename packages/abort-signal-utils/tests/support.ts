import { vi } from "vitest";

/**
 * オブジェクトからプロパティーを一時的に隠します。
 *
 * `[Symbol.dispose]()` で元の定義を復元します。
 */
export function hideProperty(target: object, key: PropertyKey): Disposable {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor !== undefined && descriptor.configurable === false) {
    throw new Error(`${String(key)} is not configurable.`);
  }

  delete (target as Record<PropertyKey, unknown>)[key];

  return {
    [Symbol.dispose](): void {
      if (descriptor === undefined) {
        delete (target as Record<PropertyKey, unknown>)[key];
      } else {
        Object.defineProperty(target, key, descriptor);
      }
    },
  };
}

/**
 * `AbortSignal.any` がない環境を再現します。
 */
export function hideAbortSignalAny(): Disposable {
  return hideProperty(AbortSignal, "any");
}

/**
 * `AbortSignal.timeout` がない環境を再現します。
 */
export function hideAbortSignalTimeout(): Disposable {
  return hideProperty(AbortSignal, "timeout");
}

/**
 * `AbortSignal.prototype.throwIfAborted` がない環境を再現します。
 */
export function hideNativeThrowIfAborted(): Disposable {
  return hideProperty(AbortSignal.prototype, "throwIfAborted");
}

/**
 * 理由が `undefined` のまま中断している稀な状態を再現します。
 */
export function createAbortedSignalWithUndefinedReason(): AbortSignal {
  const controller = new AbortController();
  controller.abort("placeholder");
  const { signal } = controller;
  Object.defineProperty(signal, "reason", {
    value: undefined,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return signal;
}

/**
 * 引数なし `abort()` の既定理由を差し替えます。
 */
export function stubDefaultAbortReason(reason: unknown): Disposable {
  class StubAbortController extends AbortController {
    public override abort(): void {
      super.abort(reason);
    }
  }

  return stubGlobals({ AbortController: StubAbortController });
}

/**
 * グローバルを一時的に差し替えます。
 */
export function stubGlobals(stubs: Readonly<Record<string, unknown>>): Disposable {
  for (const [name, value] of Object.entries(stubs)) {
    vi.stubGlobal(name, value);
  }

  return {
    [Symbol.dispose](): void {
      vi.unstubAllGlobals();
    },
  };
}

/**
 * 投げられた値（Error 以外を含む）を受け取ります。
 */
export function catchThrown(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("投げられなかった");
}

/**
 * マイクロタスクを流しても PromiseLike が未確定のままなら true を返します。
 */
export async function isStillPending(promise: PromiseLike<never>): Promise<boolean> {
  let settled = false;
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await Promise.resolve();
  return !settled;
}

/**
 * 何もしない破棄処理を返します。
 */
export function noopDisposable(): Disposable {
  return {
    [Symbol.dispose](): void {},
  };
}

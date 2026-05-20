import { tryCaptureStackTrace } from "try-capture-stack-trace";
import { vi, test, beforeEach, afterEach } from "vitest";

import getAbortReason from "../src/get-abort-reason.js";

vi.mock("try-capture-stack-trace", () => {
  return {
    tryCaptureStackTrace: vi.fn<() => void>(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const originalAbortController = globalThis.AbortController;

afterEach(() => {
  globalThis.AbortController = originalAbortController;
});

test("未中止状態のシグナルが渡されたとき、 undefined が返される", ({ expect }) => {
  // Arrange
  const ac = new AbortController();

  // Act
  const result = getAbortReason(ac.signal);

  // Assert
  expect(result).toBeUndefined();
});

test("中止済みかつ明示的な理由として TimeoutError が指定されたとき、その理由がそのまま返される", ({
  expect,
}) => {
  // Arrange
  const ac = new AbortController();
  ac.abort("TimeoutError");

  // Act
  const result = getAbortReason(ac.signal);

  // Assert
  expect(result).toBe("TimeoutError");
});

test("中止済みかつ明示的な理由として Error オブジェクトが指定されたとき、そのオブジェクトがそのまま返される", ({
  expect,
}) => {
  // Arrange
  const ac = new AbortController();
  const customError = new Error("Custom Error");
  ac.abort(customError);

  // Act
  const result = getAbortReason(ac.signal);

  // Assert
  expect(result).toStrictEqual(customError);
});

test("中止済みかつ理由が未定義で、ランタイムのデフォルト理由がオブジェクトのとき、そのオブジェクトが返され tryCaptureStackTrace が呼び出される", ({
  expect,
}) => {
  // Arrange
  const mockDefaultReason = { message: "Runtime default abort reason" };
  globalThis.AbortController = class {
    signal = {
      aborted: true,
      reason: mockDefaultReason,
    };
    abort() {}
  } as any;

  const signal = { aborted: true, reason: undefined } as unknown as AbortSignal;

  // Act
  const result = getAbortReason(signal);

  // Assert
  expect(result).toStrictEqual(mockDefaultReason);
  expect(tryCaptureStackTrace).toHaveBeenCalledWith(mockDefaultReason, getAbortReason);
});

test("中止済みかつ理由が未定義で、ランタイムのデフォルト理由が null のとき、新規の DOMException が返され tryCaptureStackTrace が呼び出される", ({
  expect,
}) => {
  // Arrange
  globalThis.AbortController = class {
    signal = {
      aborted: true,
      reason: null,
    };
    abort() {}
  } as any;

  const signal = { aborted: true, reason: undefined } as unknown as AbortSignal;

  // Act
  const result = getAbortReason(signal);

  // Assert
  expect(result).toBeInstanceOf(DOMException);
  const exception = result as DOMException;
  expect(exception.name).toBe("AbortError");
  expect(exception.message).toBe("Aborted");
  expect(tryCaptureStackTrace).toHaveBeenCalledWith(exception, getAbortReason);
});

test("中止済みかつ理由が未定義で、ランタイムのデフォルト理由がプリミティブ値のとき、新規の DOMException が返され tryCaptureStackTrace が呼び出される", ({
  expect,
}) => {
  // Arrange
  globalThis.AbortController = class {
    signal = {
      aborted: true,
      reason: "Primitive Abort Reason",
    };
    abort() {}
  } as any;

  const signal = { aborted: true, reason: undefined } as unknown as AbortSignal;

  // Act
  const result = getAbortReason(signal);

  // Assert
  expect(result).toBeInstanceOf(DOMException);
  const exception = result as DOMException;
  expect(exception.name).toBe("AbortError");
  expect(exception.message).toBe("Aborted");
  expect(tryCaptureStackTrace).toHaveBeenCalledWith(exception, getAbortReason);
});

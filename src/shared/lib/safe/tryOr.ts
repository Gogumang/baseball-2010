/**
 * try/catch · try/finally 를 한 곳에 모은 도우미 — 다른 소스는 `try` 를 쓰지 않는다(eslint `no-restricted-syntax`).
 * 예외를 삼키는 자리는 이름으로 드러난다: `tryOr`(값으로 대신) · `tryOrElse`(예외를 받아 대신) · `ignoreErrors`(그냥 삼킴).
 * 다시 던지는 예외는 없다 — `onError` 가 던지면 그대로 밖으로 나간다(원래 catch 몸통이 던진 것과 같다).
 */

/** `run` 이 던지면 `fallback` */
export function tryOr<T, F>(run: () => T, fallback: F): T | F {
  try {
    return run()
  } catch {
    return fallback
  }
}

/** `run` 이 던지면 `onError(예외)` */
export function tryOrElse<T, F>(run: () => T, onError: (error: unknown) => F): T | F {
  try {
    return run()
  } catch (error) {
    return onError(error)
  }
}

/** `run` 이 던져도 그냥 넘어간다 */
export function ignoreErrors(run: () => void): void {
  try {
    run()
  } catch {
    // 일부러 삼킨다 — 부르는 쪽 이름(`ignoreErrors`)이 그 뜻이다
  }
}

/** 비동기 `run` 이 던지거나(바로 · 기다리다) 거절되면 `fallback` */
export async function tryOrAsync<T, F>(run: () => Promise<T>, fallback: F): Promise<T | F> {
  try {
    return await run()
  } catch {
    return fallback
  }
}

/** 비동기 `run` 이 던지거나 거절되면 `onError(예외)` (기다린다) */
export async function tryOrElseAsync<T, F>(run: () => Promise<T>, onError: (error: unknown) => F | Promise<F>): Promise<T | F> {
  try {
    return await run()
  } catch (error) {
    return await onError(error)
  }
}

/** `run` 이 끝나면(던져도) `cleanup` — try/finally */
export function withFinally<T>(run: () => T, cleanup: () => void): T {
  try {
    return run()
  } finally {
    cleanup()
  }
}

/** 비동기 `run` 이 끝나면(던지거나 거절돼도) `cleanup` — try/finally */
export async function withFinallyAsync<T>(run: () => Promise<T>, cleanup: () => void): Promise<T> {
  try {
    return await run()
  } finally {
    cleanup()
  }
}

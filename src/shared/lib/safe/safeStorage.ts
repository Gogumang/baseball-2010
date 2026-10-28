import { ignoreErrors, tryOr } from '@/shared/lib/safe/tryOr'

/**
 * `localStorage` 를 막힌 환경(비공개 창 · 시험 · 꽉 참)에서도 안 던지게 감싼다.
 * 읽기 실패는 null, 쓰기 · 지우기 실패는 삼킨다(저장 실패가 게임 진행을 막지 않는다).
 */
export interface SafeStorage {
  readonly get: (key: string) => string | null
  readonly set: (key: string, value: string) => void
  readonly remove: (key: string) => void
}

function safeStorageOf(storage: () => Storage): SafeStorage {
  return {
    get: (key) => tryOr(() => storage().getItem(key), null),
    set: (key, value) => ignoreErrors(() => storage().setItem(key, value)),
    remove: (key) => ignoreErrors(() => storage().removeItem(key)),
  }
}

/** `window.localStorage` — 부를 때마다 다시 잡는다(시험이 갈아 끼운다) */
export const safeLocalStorage: SafeStorage = safeStorageOf(() => window.localStorage)

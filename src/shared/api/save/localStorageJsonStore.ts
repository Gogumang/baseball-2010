import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { ignoreErrors } from '@/shared/lib/safe/tryOr'
import { safeJsonParse } from '@/shared/lib/safe/safeJson'
import { safeLocalStorage } from '@/shared/lib/safe/safeStorage'

/** localStorage JSON 저장소. 저장소가 막혀도 게임은 기본값으로 돌아가야 하므로 실패는 삼킨다. */
export function createLocalStorageJsonStore(storageKey: string): JsonStorePort {
  return {
    load: () => safeJsonParse(safeLocalStorage.get(storageKey) ?? 'null', null),

    // 저장 실패(직렬화 실패 포함)는 진행을 막지 않는다.
    save: (value) => ignoreErrors(() => window.localStorage.setItem(storageKey, JSON.stringify(value))),
  }
}

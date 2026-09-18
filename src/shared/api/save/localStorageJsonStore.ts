import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/** localStorage JSON 저장소. 저장소가 막혀도 게임은 기본값으로 돌아가야 하므로 실패는 삼킨다. */
export function createLocalStorageJsonStore(storageKey: string): JsonStorePort {
  return {
    load: () => {
      try {
        return JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as unknown
      } catch {
        return null
      }
    },

    save: (value) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        // 저장 실패는 진행을 막지 않는다.
      }
    },
  }
}

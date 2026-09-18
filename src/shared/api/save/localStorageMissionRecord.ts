import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'

const STORAGE_KEY = 'compus-baseball/mission-cleared'

/**
 * 미션 클리어 기록 localStorage 어댑터.
 * 예전에는 메모리에만 있어서 새로고침하면 잠금이 처음으로 돌아갔다.
 * 저장소가 막힌 환경에서도 미션은 할 수 있어야 하므로 실패는 삼킨다.
 */
export function createLocalStorageMissionRecord(): MissionRecordPort {
  return {
    load: () => {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
        return Array.isArray(parsed)
          ? parsed.filter((key): key is string => typeof key === 'string')
          : []
      } catch {
        return []
      }
    },

    save: (clearedKeys) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clearedKeys))
      } catch {
        // 저장 실패는 진행을 막지 않는다.
      }
    },
  }
}

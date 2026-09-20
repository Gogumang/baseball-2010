import type { MissionClearCounts, MissionRecordPort } from '@/shared/api/save/missionRecordPort'

const STORAGE_KEY = 'compus-baseball/mission-cleared'

/** 클리어 횟수 상한 — 원본은 s8 칸에 99 까지 센다 (0xa51d0) */
const MAXIMUM_CLEARS = 99

/**
 * 미션 클리어 기록 localStorage 어댑터.
 * 저장소가 막힌 환경에서도 미션은 할 수 있어야 하므로 실패는 삼킨다.
 *
 * **예전 형식(클리어한 키 배열)도 읽는다** — 그 경우 각 키를 1회 클리어로 본다.
 */
export function createLocalStorageMissionRecord(): MissionRecordPort {
  return {
    load: () => {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
        if (Array.isArray(parsed)) {
          return Object.fromEntries(
            parsed.filter((key): key is string => typeof key === 'string').map((key) => [key, 1]),
          )
        }
        if (parsed === null || typeof parsed !== 'object') return {}
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .filter(([, count]) => typeof count === 'number' && Number.isFinite(count) && count > 0)
            .map(([key, count]) => [key, Math.min(MAXIMUM_CLEARS, Math.trunc(count as number))]),
        )
      } catch {
        return {}
      }
    },

    save: (counts: MissionClearCounts) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
      } catch {
        // 저장 실패는 진행을 막지 않는다.
      }
    },
  }
}

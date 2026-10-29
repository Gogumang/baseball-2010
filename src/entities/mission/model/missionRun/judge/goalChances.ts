import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'
import { limitOrNull } from '@/entities/mission/model/missionRun/start/startMission'
import type { MissionRun } from '@/entities/mission/model/missionRun/types'

/**
 * **남은 기회로 목표를 못 채우면 그 자리에서 실패** — 판정 0xaaa6c 모드 6 갈래가 타석 한도(aab82) · 스윙 한도(aab9a → aad1c)마다
 * 부르는 0xaa958(미션, 센 수, 한도) (직접 재역어셈, aa958~aaa5a):
 * ```
 * aa960  한도 ≤ 0 이거나 모드(+0x10[1]) == 5(투수편)면 돌아감
 * aa98a  남은 기회 = 한도 − 센 수
 * aa994  달성 9칸 = [안타 합 R+0xb4..0xc0, 단타 +0xb4, 2루타 +0xb8, 3루타 +0xbc, 홈런 +0xc0, 만루 +0xc8, 그라운드 +0xcc, 번트 +0xf4, 도루 +0x10c]
 * aa9dc  필요 9칸 = 행 [+0xa6, +0xa1 아래, +0xa0 위, +0xa0 아래, +0xa3 아래, +0xa2 위, +0xa2 아래, +0xa4 위, +0xa4 아래]
 * aaa20  필요 > 0 인 칸마다 필요 합 += 필요 · 달성 합 += 달성 ; (필요 − 달성) > 남은 기회면 상태 2(실패)
 * aaa44  min(필요 합, 한도) − 달성 합 > 남은 기회면 상태 2
 * ```
 * 타점 칸은 안 본다. 달성은 필요를 넘어도 깎지 않는다(원본 그대로). 목표가 다 찼으면(상태 0, aab5a) 이 판정 전에 성공으로 간다.
 * 판정은 판 끝(0xae3e8)뿐 아니라 공마다(0xae24c · 0xae3a0)도 돈다.
 */
const CHANCE_GOALS: readonly string[] = ['안타', '단타', '2루타', '3루타', '홈런', '만루홈런', '그라운드홈런', '번트', '도루']

/** aa960 — 한도가 있고 타자편(모드 6)일 때만 센다 */
function isChanceJudged(mission: OriginalMission, limit: number | null): limit is number {
  return limit !== null && limit > 0 && mission.side === '타자'
}

function isOutOfGoalChances(mission: OriginalMission, progress: MissionProgress, used: number, limit: number | null): boolean {
  if (!isChanceJudged(mission, limit)) return false
  const remaining = limit - used
  let requiredSum = 0
  let achievedSum = 0
  for (const name of CHANCE_GOALS) {
    const required = mission.goalCounts[name] ?? 0
    if (required <= 0) continue
    const achieved = progress.counts[name] ?? 0
    requiredSum += required
    achievedSum += achieved
    if (required - achieved > remaining) return true
  }
  return Math.min(requiredSum, limit) - achievedSum > remaining
}

/** 한도 하나로 0xaa958 — 한도가 없거나 남은 칸이 없으면 거짓 */
function isOutOfChancesUnder(run: MissionRun, limit: number | null, remaining: number | null): boolean {
  if (limit === null || remaining === null) return false
  return isOutOfGoalChances(run.mission, run.progress, limit - remaining, limit)
}

/** 타석 한도 · 스윙 한도 둘 다로 0xaa958 을 돈다 (aab82 · aab9a) */
export function isOutOfAnyGoalChances(run: MissionRun, remainingPlateAppearances: number | null): boolean {
  return (
    isOutOfChancesUnder(run, limitOrNull(run.mission.plateAppearanceLimit), remainingPlateAppearances) ||
    isOutOfChancesUnder(run, limitOrNull(run.mission.swingLimit), run.remainingSwings)
  )
}

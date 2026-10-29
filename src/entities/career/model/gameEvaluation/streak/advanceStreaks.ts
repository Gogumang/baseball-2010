import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { SeasonStats } from '@/entities/career/model/seasonStats'

/** u8 칸 — 참이면 +1(0xff 에서 감김), 아니면 0 */
const step = (count: number, on: boolean) => (on ? (count + 1) & 0xff : 0)

/**
 * 경기 뒤 연속 기록 칸만 잇는다 — 안타 2개 이상 · 홈런 · 무안타 경기 수. 평가 0xa719c 모드 4 갈래(a71d0~a7262)의
 * `0xa4ce0(S, 칸, 참?)` 이 참이면 +1(u8), 아니면 0. **평가가 도는 정규시즌 경기만** 부른다(0x4f268, 부르는 쪽이 가른다).
 */
export function advanceStreaks(career: PlayerCareer, stats: SeasonStats): PlayerCareer {
  return {
    ...career,
    streaks: {
      multiHit: step(career.streaks.multiHit, stats.hits >= 2),
      homeRun: step(career.streaks.homeRun, stats.homeRuns >= 1),
      hitless: step(career.streaks.hitless, stats.hits === 0),
    },
  }
}

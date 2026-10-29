import { RANDOM_LIMIT } from '@/entities/game/model/quickAtBat/constants'
import type { PitcherStats, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat/types'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { balanceGrid, balanceNumber } from '@/shared/config/balance'

// 투수 구위 등급 표 (0xd896c, 0xb74bc 가 읽는다). 줄 = 능력 ÷ 250 (0~3), 값은 누적 백분율이다.
// 표와 칸 폭(250)은 사람 타석의 제구 등급 0xb74bc 와 같은 원본 표라 숨은 판정값 표 `pitching.controlTierRows` ·
// `pitching.controlRowWidth` 를 같이 읽는다 (원본 값은 `BALANCE.quickAtBat.pitchGradeTable` · `pitchGradeBand` 와 같다)

/** 체력%로 부른 제구·구속 (`QuickAtBatPitcher.tired`) — 없으면 90 값 */
export function tiredStatsOf(pitcher: QuickAtBatPitcher): PitcherStats {
  return pitcher.tired ?? { control: pitcher.control, velocity: pitcher.velocity }
}

/** 등급 표에서 이 능력이 읽는 줄 — 능력 ÷ 칸 폭, 표 안으로 자른다 */
function gradeRowOf(ability: number): readonly number[] {
  const table = balanceGrid('pitching.controlTierRows')
  const band = Math.min(table.length - 1, Math.max(0, Math.trunc(ability / balanceNumber('pitching.controlRowWidth'))))
  return table[band]
}

/**
 * 구위 등급 (0xb74bc → 부르는 쪽에서 다시 1 을 뺀다).
 * 표에서 걸린 칸을 i 라 할 때, 지치지 않았으면 i+1, 지쳤으면 max(i−1, 0) 이고
 * 0xc11f0 이 거기서 1 을 더 빼 0~4 로 만든다.
 */
export function pitchGradeOf(ability: number, stamina: number, random: RandomPort): number {
  const row = gradeRowOf(ability)
  const rolled = random.rand(0, RANDOM_LIMIT)
  const index = row.findIndex((percent) => rolled < percent * 100)
  const found = index === -1 ? row.length - 1 : index
  const graded = stamina !== 0 ? found + 1 : Math.max(found - 1, 0)
  return Math.max(0, graded - 1)
}

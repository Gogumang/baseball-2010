import type { SwingBoost } from '@/entities/game/model/quickAtBat/otherSlices'
import type { QuickAceSlot, QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat/types'
import { D_LEVEL } from '@/shared/config/original/dLevel'

const ACE_SLOT_COUNT = 5
/** 보정 표가 없는 선수 — 마선수가 아니다 */
const NO_ACE = -1

const clampSlot = (value: number) => Math.min(Math.max(Math.trunc(value), 0), ACE_SLOT_COUNT - 1)
/** 보정 표 칸 k = 레벨·5 + 순번 */
const aceKOf = (ace: QuickAceSlot) => clampSlot(ace.level) * ACE_SLOT_COUNT + clampSlot(ace.order)
const aceKOrNone = (ace: QuickAceSlot | undefined) => (ace === undefined ? NO_ACE : aceKOf(ace))
const boostAt = (column: readonly number[], k: number) => (k === NO_ACE ? 0 : (column[k] ?? 0))

/**
 * 간이 타석이 0xab214 에 넘기는 12바이트 보정 구조체 (0xc11f0 c11fe~c12c4, 디스어셈 대조 — 확정).
 * ```
 * c11fe  memset(sp+0x74, 0, 12)
 * c1226  if 0xb633c(타자):  k = 레벨·5 + 순번 (레벨 = s8 mgr[0x13f + 순번], 순번 = 0xb63a0)
 *            out+0 = D[0x100+2k] · out+2 = D[0x132+2k]          ; 히트 · 파워
 * c1278  if 0xb633c(투수):  k = 레벨·5 + 순번 (레벨 = s8 mgr[0x13a + 순번])
 *            out+4 = D[0xce+2k] · out+6 = D[0x9c+2k]            ; 구속 · 제구
 * ```
 * 사람 타석의 0x34d6c 와 달리 **필살·마구 번호를 보지 않고** 마선수면 늘 붙으며 % 칸(out+8~0xb)은 0 이다.
 * 표 값은 레벨 0·1 150 · 2 180 · 3 200 · 4 220 (다섯 순번 같다). 두 겨루기(c12f8·c135a)와 세 번째 스트라이크
 * 겨루기(c1764)는 0xb570c 를 따로 불러 이 보정을 안 받는다.
 */
export function quickSwingBoostOf(batter: QuickAtBatBatter, pitcher: QuickAtBatPitcher): SwingBoost {
  const table = D_LEVEL.boost
  const batterK = aceKOrNone(batter.ace)
  const pitcherK = aceKOrNone(pitcher.ace)
  return {
    batterHit: boostAt(table.aceBatterHit, batterK),
    batterPower: boostAt(table.aceBatterPower, batterK),
    pitcherVelocity: boostAt(table.acePitcherSpeed, pitcherK),
    pitcherControl: boostAt(table.acePitcherControl, pitcherK),
    solidPercent: 0,
    homeRunPercent: 0,
  }
}
